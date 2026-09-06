import { render, screen, fireEvent, act } from "@testing-library/react";
import { ChatTalk } from "@/components/playground/chat-talk";

jest.mock("@/services/platform/tools", () => ({
  useAgentTools: () => ({ data: [], isLoading: false }),
}));

type Handler = (event: unknown) => void;

class MockSocket {
  static instances: MockSocket[] = [];
  static OPEN = 1;
  readyState = 0;
  sent: string[] = [];
  onopen: Handler | null = null;
  onmessage: Handler | null = null;
  onerror: Handler | null = null;
  onclose: Handler | null = null;

  constructor(public url: string) {
    MockSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.readyState = 3;
    this.onclose?.({});
  }

  open() {
    this.readyState = 1;
    this.onopen?.({});
  }

  receive(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

describe("ChatTalk socket protocol", () => {
  beforeEach(() => {
    MockSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockSocket;
    // No backend in jsdom: ticket fetch fails fast, socket falls back to cookies.
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockRejectedValue(new Error("no backend"));
  });

  afterEach(() => {
    delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  async function renderChat() {
    render(<ChatTalk agentId="agent-1" agentName="Test Agent" />);
    await act(async () => {});
    return MockSocket.instances[0];
  }

  it("connects to the agent voice socket and sends init", async () => {
    const socket = await renderChat();
    expect(socket.url).toBe("ws://localhost:5001/chat/v1/agent-1");
    act(() => socket.open());
    expect(socket.sent).toEqual([
      JSON.stringify({ type: "init", meta_data: { agent_id: "agent-1", source: "ui-chat" } }),
    ]);
    // Connected line is pushed on open (the backend sends no ack here)…
    expect(screen.getByText(/Chatting with Test Agent/)).toBeInTheDocument();
    // …and a stray ack must not duplicate it.
    act(() => socket.receive({ type: "ack" }));
    expect(screen.getAllByText(/Chatting with Test Agent/)).toHaveLength(1);
  });

  it("attaches the ws ticket when the backend mints one", async () => {
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ticket: "t-123", expires_in: 60 }),
    });
    render(<ChatTalk agentId="agent-9" agentName="Test Agent" />);
    await act(async () => {});
    expect(MockSocket.instances[0].url).toBe("ws://localhost:5001/chat/v1/agent-9?token=t-123");
  });

  it("sends typed turns and renders both transcript roles", async () => {
    const socket = await renderChat();
    act(() => socket.open());

    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Hello there" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(socket.sent).toContainEqual(JSON.stringify({ type: "text", data: "Hello there" }));
    expect(screen.getByText("Hello there")).toBeInTheDocument();

    act(() => {
      socket.receive({ type: "text", role: "user", data: "Hello there (heard)" });
      socket.receive({ type: "text", role: "agent", data: "Hi! How can I help?" });
    });
    expect(screen.getByText("Hello there (heard)")).toBeInTheDocument();
    expect(screen.getByText("Hi! How can I help?")).toBeInTheDocument();
  });

  it("echoes marks and ignores audio frames quietly", async () => {
    const socket = await renderChat();
    act(() => socket.open());
    act(() => {
      socket.receive({ type: "mark", name: "m-1" });
      socket.receive({ type: "audio", data: "AAAA" });
    });
    expect(socket.sent).toContainEqual(JSON.stringify({ type: "mark", name: "m-1" }));
  });

  it("shows a backend error when the socket dies before connect", async () => {
    const socket = await renderChat();
    act(() => {
      socket.onerror?.({});
    });
    expect(screen.getByText(/Couldn't reach the voice backend/)).toBeInTheDocument();
  });
});
