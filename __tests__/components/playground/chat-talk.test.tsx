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
    expect(socket.url).toBe("ws://localhost:5001/chat/v1/agent-1?leg=browser");
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
    expect(MockSocket.instances[0].url).toBe("ws://localhost:5001/chat/v1/agent-9?leg=browser&token=t-123");
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

  it("skips engine stream sentinels instead of rendering them", async () => {
    const socket = await renderChat();
    act(() => socket.open());
    act(() => {
      socket.receive({ type: "text", role: "agent", data: "<beginning_of_stream>" });
      socket.receive({ type: "text", role: "agent", data: "<end_of_stream>" });
      socket.receive({ type: "text", role: "agent", data: "Real reply" });
    });
    expect(screen.queryByText("<beginning_of_stream>")).not.toBeInTheDocument();
    expect(screen.queryByText("<end_of_stream>")).not.toBeInTheDocument();
    expect(screen.getByText("Real reply")).toBeInTheDocument();
  });

  it("reconnects with backoff after a mid-thread drop and preserves turns", async () => {
    jest.useFakeTimers();
    try {
      const socket = await renderChat();
      act(() => socket.open());
      fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Hello" } });
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
      expect(screen.getByText("Hello")).toBeInTheDocument();

      // Unexpected drop after live: transcript survives, retry UI appears.
      act(() => {
        socket.onclose?.({});
      });
      expect(screen.getAllByText(/retrying \(1\/3\)/i).length).toBeGreaterThan(0);
      expect(screen.getByText("Hello")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Cancel reconnect/i })).toBeInTheDocument();

      // Backoff fires a fresh socket on the same thread.
      await act(async () => {
        jest.advanceTimersByTime(900);
      });
      expect(MockSocket.instances).toHaveLength(2);
      expect(MockSocket.instances[1].url).toBe("ws://localhost:5001/chat/v1/agent-1?leg=browser");
      act(() => MockSocket.instances[1].open());
      expect(screen.getByText(/Reconnected/)).toBeInTheDocument();
      expect(screen.getByText("Hello")).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  it("focuses the error summary for screen-reader users", async () => {
    await renderChat();
    act(() => {
      MockSocket.instances[0].onerror?.({});
    });
    const summary = screen.getByRole("alert");
    expect(summary).toHaveFocus();
  });

  it("exposes visible focus rings and pointer affordances on controls", async () => {
    const socket = await renderChat();
    act(() => socket.open());
    const send = screen.getByRole("button", { name: "Send message" });
    expect(send.className).toContain("cursor-pointer");
    expect(send.className).toContain("focus-visible:ring-2");
    const input = screen.getByLabelText("Chat message");
    expect(input.className).toContain("focus-visible:ring-2");
  });
});
