import { env } from "./env";
import { wsTicketSchema } from "./schemas/auth";

export const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL;
export const WS_BASE_URL = env.NEXT_PUBLIC_WS_BASE_URL;

/** REST APIs are dual-served under `/api/v1` (backend spec 0007); the client
 *  always uses the new prefix so every call site moves at once. */
export const API_V1 = "/api/v1";

/** Browser-leg call socket: ?leg=browser keeps the backend on default IO handlers
 *  even when the agent is configured with a telephony provider (the carrier
 *  handlers speak Twilio-shaped events and would drop browser {type}-frames,
 *  leaving the call with no stream_sid, no greeting and no ingest). */
export function buildTalkSocketUrl(baseUrl: string, agentId: string, ticket?: string): string {
  const params = new URLSearchParams({ leg: "browser" });
  if (ticket) params.set("token", ticket);
  return `${baseUrl}/chat/v1/${agentId}?${params.toString()}`;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${API_V1}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Sessions ride an httpOnly cookie; include it on every API call.
  const response = await fetch(url, { ...options, headers, credentials: "include" });

  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      const path = window.location.pathname;
      const isPublic = ["/login", "/accept-invite"].some((route) =>
        path.startsWith(route)
      );
      if (!isPublic) {
        // replace (not href): a 401 page must not stay in history, and this
        // runs outside React components where useRouter is unavailable.
        window.location.replace(`/login?clear_session=1&next=${encodeURIComponent(path + window.location.search)}`);
      }
    }
    const errorData = await response.json().catch(() => ({}));
    const detail = Array.isArray(errorData.detail)
      ? errorData.detail.map((entry: { msg?: string }) => entry.msg ?? "Invalid request").join("; ")
      : errorData.detail;
    throw new ApiError(
      detail || errorData.message || `API Error: ${response.statusText}`,
      response.status
    );
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

/**
 * Extract `data` from the standard `{ok, data, message, meta}` envelope.
 * Auth endpoints serve enveloped payloads under `/api/v1` (backend spec
 * 0006); error responses keep FastAPI `detail`, which the error path above
 * already reads, so this is success-path only.
 */
export function unwrapEnvelopeData(raw: unknown): unknown {
  return (raw as { data?: unknown })?.data;
}

/**
 * Single-use voice-socket ticket (`POST /api/v1/auth/ws-ticket`).
 * Canonical location for the ticket helper — `src/services/auth.ts`
 * re-exports it so playground imports keep working.
 * Sessions ride the httpOnly cookie (`credentials: "include"` above), so
 * when ticket minting fails the caller falls back to cookie auth
 * (see `buildTalkSocketUrl` + live-talk `try { ticket } catch { cookie }`).
 */
export async function fetchWsTicket(): Promise<string> {
  const raw = await apiClient<unknown>("/auth/ws-ticket", { method: "POST" });
  return wsTicketSchema.parse(unwrapEnvelopeData(raw)).ticket;
}
