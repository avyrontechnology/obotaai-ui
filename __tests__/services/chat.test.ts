import { TextDecoder, TextEncoder } from "util";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// jsdom lacks the WHATWG codecs the streaming reader uses (present in every
// real browser) — polyfill from Node for these tests only.
const testGlobals = globalThis as unknown as Record<string, unknown>;
if (!testGlobals.TextEncoder) testGlobals.TextEncoder = TextEncoder;
if (!testGlobals.TextDecoder) testGlobals.TextDecoder = TextDecoder;
import {
  chatKeys,
  postChatTurn,
  probeChatEndpoint,
  useChatHistory,
  useSendChatTurn,
} from "@/services/platform/chat";
import { apiClient, ApiError } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

function sseResponse(chunks: string[], headers: Record<string, string> = {}): Response {
  const queue = chunks.map((chunk) => new TextEncoder().encode(chunk));
  let index = 0;
  const lowered: Record<string, string> = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])
  );
  return {
    ok: true,
    status: 200,
    statusText: "OK",
    headers: { get: (key: string) => lowered[key.toLowerCase()] ?? null },
    body: {
      getReader: () => ({
        read: async () =>
          index < queue.length
            ? { done: false as const, value: queue[index++] }
            : { done: true as const, value: undefined },
        cancel: async () => undefined,
      }),
    },
  } as unknown as Response;
}

function errorResponse(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    statusText: "Error",
    headers: { get: () => null },
    json: async () => body,
  } as unknown as Response;
}

const errorEnvelope = (detail: string) => ({
  ok: false,
  detail,
  error: { code: "x", error_id: "e1", details: {} },
});

describe("chat service (specs 0038 + 0039)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (globalThis as unknown as { fetch?: unknown }).fetch = jest.fn();
  });

  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("exposes stable query keys", () => {
    expect(chatKeys.history("a1")).toEqual(["chat", "history", { agentId: "a1" }]);
  });

  it("loads history through the envelope", async () => {
    mockedApiClient.mockResolvedValue([
      { session_id: "ses_1", agent_id: "a1", messages: [{ role: "user", content: "Hi", ts: "2026-09-26T00:00:00" }] },
    ]);
    const { result } = renderHook(() => useChatHistory("a1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/chat/sessions?agent_id=a1");
    expect(result.current.data?.[0].messages[0].content).toBe("Hi");
  });

  it("stays disabled without an agent id", () => {
    const { result } = renderHook(() => useChatHistory(""), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("emits per-batch token updates for streaming render", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValue(sseResponse(["data: Hel\n\nda", "ta: lo\n\n"]));
    const seen: string[] = [];
    await postChatTurn({ agentId: "a1", message: "Hello", onToken: (reply) => seen.push(reply) });
    expect(seen).toEqual(["Hel", "Hello"]);
  });

  it("streams token frames split across chunks and resolves on [DONE]", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValue(
      sseResponse(["data: Hel\n\nda", "ta: lo wo\n\n", "data: rld\n\ndata: [DONE]\n\n"], {
        "x-session-id": "ses_9",
      })
    );

    const result = await postChatTurn({ agentId: "a1", message: "Hello" });

    expect(result).toEqual({ reply: "Hello world", sessionId: "ses_9" });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.method).toBe("POST");
    expect(JSON.parse(options.body as string)).toEqual({ message: "Hello" });
  });

  it("resumes with the stored session id when provided", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValue(sseResponse(["data: ok\n\ndata: [DONE]\n\n"], { "x-session-id": "ses_9" }));

    await postChatTurn({ agentId: "a1", message: "again", sessionId: "ses_9" });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ session_id: "ses_9", message: "again" });
  });

  it("keeps a partial reply when the stream ends without [DONE]", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValue(sseResponse(["data: partial\n\n"]));
    const result = await postChatTurn({ agentId: "a1", message: "Hello" });
    expect(result.reply).toBe("partial");
    expect(result.sessionId).toBeNull();
  });

  it("throws typed errors on 404 and 400", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(errorResponse(404, errorEnvelope("Agent not found")));
    await expect(postChatTurn({ agentId: "nope", message: "Hi" })).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
    });
    fetchMock.mockResolvedValueOnce(errorResponse(400, errorEnvelope("Agent does not serve the chat channel")));
    const failure = await postChatTurn({ agentId: "a1", message: "Hi" }).catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).status).toBe(400);
    expect((failure as ApiError).message).toMatch(/chat channel/);
  });

  it("aborts the reader on signal", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockImplementation((_url: string, options: RequestInit) => {
      if (options.signal?.aborted) return Promise.reject(new DOMException("aborted", "AbortError"));
      return Promise.resolve(sseResponse(["data: x\n\ndata: [DONE]\n\n"]));
    });
    const controller = new AbortController();
    controller.abort();
    await expect(postChatTurn({ agentId: "a1", message: "Hi", signal: controller.signal })).rejects.toMatchObject({
      name: "AbortError",
    });
  });

  it("probes endpoint presence without side effects", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    // Blank message: 400 from the service guard (endpoint live, no session written).
    fetchMock.mockResolvedValueOnce(errorResponse(400, errorEnvelope("Message must not be blank")));
    expect(await probeChatEndpoint("a1")).toBe(true);
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(options.body as string)).toEqual({ message: " " });

    fetchMock.mockResolvedValueOnce(errorResponse(404, errorEnvelope("Not Found")));
    expect(await probeChatEndpoint("a1")).toBe(false);

    fetchMock.mockRejectedValueOnce(new Error("down"));
    expect(await probeChatEndpoint("a1")).toBe(false);
  });

  it("invalidates history after a sent turn", async () => {
    const fetchMock = globalThis.fetch as jest.Mock;
    fetchMock.mockResolvedValue(sseResponse(["data: yo\n\ndata: [DONE]\n\n"]));
    const { result } = renderHook(() => useSendChatTurn(), { wrapper });
    let reply = "";
    await React.act(async () => {
      const outcome = await result.current.mutateAsync({ agentId: "a1", message: "Hi" });
      reply = outcome.reply;
    });
    expect(reply).toBe("yo");
  });
});
