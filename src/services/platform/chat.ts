import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, redirectToLoginOn401, throwApiError, API_BASE_URL } from "@/lib/api-client";
import {
  chatHistorySchema,
  SESSION_ID_HEADER,
  SSE_DONE_MARKER,
  type ChatHistory,
} from "@/lib/schemas/chat";

/** Playground text chat over the HTTP chat endpoint (specs 0038 + 0039).
 *
 *  Follows the `voices.ts` react-query pattern. The SSE turn posts through a
 *  fetch-reader (token frames accumulate, `[DONE]` resolves); the
 *  resumed/minted session id rides the `x-session-id` response header, so
 *  multi-turn continuation needs no extra round-trip.
 */

export const chatKeys = {
  all: ["chat"] as const,
  history: (agentId: string) => ["chat", "history", { agentId }] as const,
};

export function useChatHistory(agentId: string, enabled = true) {
  return useQuery({
    queryKey: chatKeys.history(agentId),
    queryFn: async (): Promise<ChatHistory> => {
      const raw = await apiClient<unknown>(`/chat/sessions?agent_id=${encodeURIComponent(agentId)}`);
      return chatHistorySchema.parse(raw);
    },
    staleTime: 30 * 1000,
    retry: false,
    enabled: enabled && agentId.length > 0,
  });
}

export interface ChatTurnResult {
  reply: string;
  /** Resumed/minted session id from the `x-session-id` header (null when
   *  the backend predates session surfacing — history stays read-only then). */
  sessionId: string | null;
}

export interface SendChatTurnInput {
  agentId: string;
  message: string;
  sessionId?: string;
  signal?: AbortSignal;
  /** Called with the accumulated reply after each frame batch (single state
   *  update per batch, not per byte) for streaming render. */
  onToken?: (replySoFar: string) => void;
}

/** Split one SSE `data:` payload off a line; null for non-data lines. */
function dataPayload(line: string): string | null {
  if (!line.startsWith("data:")) return null;
  const payload = line.slice("data:".length);
  // Framing emits `data: <slice>` — strip the single framing space, never
  // the slice content (fixed 120-char windows keep interior spacing).
  return payload.startsWith(" ") ? payload.slice(1) : payload;
}

/** POST one turn and stream the reply. Exported for tests (mocked fetch). */
export async function postChatTurn({ agentId, message, sessionId, signal, onToken }: SendChatTurnInput): Promise<ChatTurnResult> {
  const response = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(agentId)}`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(sessionId ? { session_id: sessionId, message } : { message }),
    signal,
  });
  if (!response.ok) {
    redirectToLoginOn401(response);
    await throwApiError(response);
  }
  const headerSessionId = response.headers.get(SESSION_ID_HEADER);

  let reply = "";
  const body = response.body;
  if (body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      // One state update per frame batch, not per byte: accumulate the
      // chunk, then split and append.
      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";
      for (const frame of frames) {
        for (const line of frame.split("\n")) {
          const payload = dataPayload(line);
          if (payload === null) continue;
          if (payload === SSE_DONE_MARKER) {
            buffer = "";
            try {
              reader.cancel();
            } catch {
              /* already closed */
            }
            return { reply, sessionId: headerSessionId };
          }
          reply += payload;
        }
      }
      onToken?.(reply);
    }
    // Unterminated stream (no [DONE]): keep what arrived.
    for (const line of buffer.split("\n")) {
      const payload = dataPayload(line);
      if (payload !== null && payload !== SSE_DONE_MARKER) reply += payload;
    }
  }
  return { reply, sessionId: headerSessionId };
}

/** Blank-message probe: the endpoint exists when this is anything but 404
 *  (blank fails the service guard with 400 without writing a session or
 *  touching the LLM). Network failures answer false — the caller falls back
 *  to the legacy WS text-frame path, which surfaces backend reachability. */
export async function probeChatEndpoint(agentId: string): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/chat/${encodeURIComponent(agentId)}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: " " }),
    });
    if (response.status === 401) redirectToLoginOn401(response);
    await response.body?.cancel?.().catch(() => undefined);
    return response.status !== 404;
  } catch {
    return false;
  }
}

export function useSendChatTurn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SendChatTurnInput): Promise<ChatTurnResult> => postChatTurn(input),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.history(variables.agentId) });
    },
  });
}
