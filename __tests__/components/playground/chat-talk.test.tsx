import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatTalk } from "@/components/playground/chat-talk";
import { apiClient } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

jest.mock("@/services/auth", () => ({
  fetchWsTicket: jest.fn(),
}));

jest.mock("@/services/platform/tools", () => ({
  useAttachedTools: () => ({ attached: [], refs: [], isLoading: false, isError: false }),
}));

const mockedApiClient = apiClient as jest.Mock;

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

function sseBody(chunks: string[], headers: Record<string, string> = {}) {
  const queue = chunks.map((chunk) => ({ chunk }));
  let index = 0;
  const lowered: Record<string, string> = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (key: string) => lowered[key.toLowerCase()] ?? null },
    // Frames arrive pre-split here; the component accumulates per chunk.
    body: {
      getReader: () => ({
        read: async () =>
          index < queue.length
            ? { done: false as const, value: queue[index++].chunk }
            : { done: true as const, value: undefined },
        cancel: async () => undefined,
      }),
    },
  };
}

// Minimal TextDecoder stand-in: values are already strings.
class FakeDecoder {
  decode(value: unknown) {
    return typeof value === "string" ? value : "";
  }
}

function errorBody(status: number, detail: string) {
  return {
    ok: false,
    status,
    statusText: "Error",
    headers: { get: () => null },
    json: async () => ({ ok: false, detail, error: { code: "x", error_id: "e", details: {} } }),
  };
}

describe("ChatTalk over HTTP (specs 0038 + 0039)", () => {
  beforeEach(() => {
    MockSocket.instances = [];
    (globalThis as unknown as { WebSocket: unknown }).WebSocket = MockSocket;
    (globalThis as unknown as { fetch: unknown }).fetch = jest.fn();
    (globalThis as unknown as { TextDecoder: unknown }).TextDecoder = FakeDecoder;
    mockedApiClient.mockResolvedValue([]);
    jest.clearAllMocks();
    mockedApiClient.mockResolvedValue([]);
  });

  afterEach(() => {
    delete (globalThis as unknown as { WebSocket?: unknown }).WebSocket;
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
    delete (globalThis as unknown as { TextDecoder?: unknown }).TextDecoder;
  });

  function renderChat(props: { chatSupported?: boolean; canChat?: boolean } = {}) {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
      <QueryClientProvider client={client}>
        <ChatTalk agentId="agent-1" agentName="Test Agent" chatSupported canChat {...props} />
      </QueryClientProvider>
    );
  }

  it("renders the voice-only notice without a composer when the agent has no chat channel", () => {
    renderChat({ chatSupported: false });
    expect(screen.getByRole("alert")).toHaveTextContent(/doesn't serve the chat channel/);
    expect(screen.queryByLabelText("Chat message")).not.toBeInTheDocument();
    expect(globalThis.fetch as jest.Mock).not.toHaveBeenCalled();
    expect(MockSocket.instances).toHaveLength(0);
  });

  it("probes HTTP, loads history backlog, and sends a streaming turn", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementation((url: string, options: RequestInit) => {
      const body = JSON.parse((options.body as string) ?? "{}");
      if (body.message === " ") return Promise.resolve(errorBody(400, "Message must not be blank"));
      return Promise.resolve(
        sseBody(["data: Hel\n\nda", "ta: lo\n\ndata: [DONE]\n\n"], { "x-session-id": "ses_1" })
      );
    });
    mockedApiClient.mockResolvedValue([
      {
        session_id: "ses_0",
        agent_id: "agent-1",
        messages: [{ role: "user", content: "Earlier", ts: "2026-09-26T00:00:00" }],
      },
    ]);
    renderChat();

    // Backlog from persisted history renders above the live thread.
    expect(await screen.findByText("Earlier")).toBeInTheDocument();
    expect(await screen.findByText(/Chatting with Test Agent/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Hello there" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    expect(await screen.findByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("Hello there")).toBeInTheDocument();
    // Session continuation: the surfaced id rides the next turn.
    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Again" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => {
      const posts = fetchMock.mock.calls.filter((call) => {
        try {
          return JSON.parse((call[1] as RequestInit).body as string).message === "Again";
        } catch {
          return false;
        }
      });
      expect(posts.length).toBe(1);
      expect(JSON.parse((posts[0][1] as RequestInit).body as string)).toEqual({
        session_id: "ses_1",
        message: "Again",
      });
    });
  });

  it("shows unavailable on 404 without echoing the distinction (no oracle)", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementation((url: string, options: RequestInit) => {
      const body = JSON.parse((options.body as string) ?? "{}");
      if (body.message === " ") return Promise.resolve(errorBody(400, "Message must not be blank"));
      return Promise.resolve(errorBody(404, "Agent not found"));
    });
    renderChat();
    await screen.findByText(/Chatting with Test Agent/);

    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText(/unavailable/)).toBeInTheDocument();
  });

  it("shows the voice-only notice on 400 channel mismatch", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementation((url: string, options: RequestInit) => {
      const body = JSON.parse((options.body as string) ?? "{}");
      if (body.message === " ") return Promise.resolve(errorBody(400, "Message must not be blank"));
      return Promise.resolve(errorBody(400, "Agent does not serve the chat channel"));
    });
    renderChat();
    await screen.findByText(/Chatting with Test Agent/);

    fireEvent.change(screen.getByLabelText("Chat message"), { target: { value: "Hi" } });
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    expect(await screen.findByText(/doesn't serve the chat channel/)).toBeInTheDocument();
  });

  it("falls back to the WS text frames when the endpoint 404s (old backend)", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValue(errorBody(404, "Not Found"));
    const { fetchWsTicket } = jest.requireMock("@/services/auth") as { fetchWsTicket: jest.Mock };
    fetchWsTicket.mockRejectedValue(new Error("no ticket"));
    renderChat();

    await waitFor(() => expect(MockSocket.instances).toHaveLength(1));
    const socket = MockSocket.instances[0];
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/chat/agent-1"),
      expect.objectContaining({ method: "POST" })
    );
    act(() => socket.open());
    expect(socket.sent).toEqual([
      JSON.stringify({ type: "init", meta_data: { agent_id: "agent-1", source: "ui-chat" } }),
    ]);
    expect(screen.getByText(/Chatting with Test Agent/)).toBeInTheDocument();
  });
});
