import { env } from "./env";

export const API_BASE_URL = env.NEXT_PUBLIC_API_BASE_URL;
export const WS_BASE_URL = env.NEXT_PUBLIC_WS_BASE_URL;

/** Browser-leg call socket: ?leg=browser keeps the backend on default IO handlers
 *  even when the agent is configured with a telephony provider (the carrier
 *  handlers speak Twilio-shaped events and would drop browser {type}-frames,
 *  leaving the call with no stream_sid, no greeting and no ingest).
 *
 *  Single-app contract (specs 0021/0048/0054): the socket lives at
 *  `WS /api/v1/chat/v1/{agent_id}` and the only credential is the single-use
 *  `?ticket=` minted by `POST /api/v1/auth/ws-ticket`. The retired
 *  quickstart contract (bare `/chat/v1` path, `?token=`) is gone — no alias,
 *  no fallback. A wrong path is rejected before the gate ever runs. */
export function buildTalkSocketUrl(baseUrl: string, agentId: string, ticket?: string): string {
  const params = new URLSearchParams({ leg: "browser" });
  if (ticket) {
    params.set("ticket", ticket);
  }
  return `${baseUrl.replace(/\/+$/, "")}/api/v1/chat/v1/${encodeURIComponent(agentId)}?${params.toString()}`;
}

/** Voice WS close codes owned by the channel (spec 0021, M2). Clients branch
 *  on codes, never on messages. */
export const WS_CLOSE_DENIED = 4401;
export const WS_CLOSE_DARK = 4403;
export const WS_CLOSE_UNKNOWN_AGENT = 4404;

/** User-facing copy per close code. Denied/unknown stay deliberately vague
 *  (no oracle); identifiers only, never the ticket. */
export function wsCloseReason(code: number): string | null {
  switch (code) {
    case WS_CLOSE_DENIED:
      return "The voice session was denied — your sign-in or ticket expired, or you lack call permission. Rejoin to mint a fresh ticket.";
    case WS_CLOSE_DARK:
      return "The realtime endpoint is disabled on this backend (cutover flag off). Try again later or contact your admin.";
    case WS_CLOSE_UNKNOWN_AGENT:
      return "Agent not found or not in your organization.";
    default:
      return null;
  }
}

export interface ApiErrorDetails {
  code?: string;
  errorId?: string;
  problems?: string[];
  /** Phase A channel allowlist (spec 0028): rejected + servable channels. */
  channels?: string[];
  valid?: string[];
  /** FastAPI 422 per-field failures under error.details.errors. */
  errors?: unknown;
  [key: string]: unknown;
}

export class ApiError extends Error {
  status: number;
  details: ApiErrorDetails | null;
  constructor(message: string, status: number, details: ApiErrorDetails | null = null) {
    super(message);
    this.status = status;
    this.details = details;
    this.name = "ApiError";
  }
}

/** Agent write-time validation problems (spec 0022, slice 2).
 *  Backend 400 envelope: { ok:false, detail, error:{ code, details:{ problems[] } } }.
 *  Returns the `problems[]` strings, or an empty list when the error carries none. */
export function agentValidationProblems(error: unknown): string[] {
  if (error instanceof ApiError) {
    const problems = error.details?.problems;
    if (Array.isArray(problems)) return problems.filter((p): p is string => typeof p === "string");
  }
  return [];
}

export interface AgentChannelRejection {
  channels: string[];
  valid: string[];
}

/** Phase A channel allowlist rejection (spec 0028): details carries
 *  `{ channels: rejected[], valid: servable[] }` instead of problems[]. */
export function agentChannelRejection(error: unknown): AgentChannelRejection | null {
  if (error instanceof ApiError) {
    const { channels, valid } = error.details ?? {};
    if (Array.isArray(channels) && Array.isArray(valid)) {
      return {
        channels: channels.filter((c): c is string => typeof c === "string"),
        valid: valid.filter((v): v is string => typeof v === "string"),
      };
    }
  }
  return null;
}

/** Request-validation 422 per-field failures (`error.details.errors[]`) rendered
 *  as `path: message` strings. Covers create/PUT request-schema rejections
 *  (bad `pipeline` literal, empty `channels`, duplicate channels) that never
 *  become problems[].
 *
 *  Single-app contract (backend spec 0052): each record carries only
 *  `{ loc, type }` — `msg`/`input`/`ctx`/`url` are never sent, so there is no
 *  server text to render. The client maps `type` to its own copy, keyed by
 *  the `loc` path after the leading `body`/`query`/`path` segment. Unknown
 *  types fall back to the raw type name (never blank). */
const VALIDATION_TYPE_COPY: Record<string, string> = {
  missing: "Required",
  extra_forbidden: "Unknown field",
  string_too_short: "Too short",
  string_too_long: "Too long",
  too_short: "Too short",
  too_long: "Too long",
  greater_than: "Too small",
  greater_than_equal: "Too small",
  less_than: "Too large",
  less_than_equal: "Too large",
  literal_error: "Invalid value",
  enum: "Invalid value",
  value_error: "Invalid value",
  json_invalid: "Invalid JSON",
};

const LOCATION_SCOPE_SEGMENTS = new Set(["body", "query", "path", "header", "cookie"]);

export function agentRequestErrors(error: unknown): string[] {
  if (error instanceof ApiError) {
    const { errors } = error.details ?? {};
    if (Array.isArray(errors)) {
      return errors.flatMap((entry): string[] => {
        if (!entry || typeof entry !== "object") return [];
        const record = entry as Record<string, unknown>;
        const type = typeof record.type === "string" && record.type ? record.type : null;
        if (!type) return [];
        const message = VALIDATION_TYPE_COPY[type] ?? type;
        const segments = Array.isArray(record.loc)
          ? record.loc.filter(
              (p): p is string | number => typeof p === "string" || typeof p === "number"
            )
          : [];
        if (segments.length > 0 && typeof segments[0] === "string" && LOCATION_SCOPE_SEGMENTS.has(segments[0])) {
          segments.shift();
        }
        return [segments.length > 0 ? `${segments.join(".")}: ${message}` : message];
      });
    }
  }
  return [];
}

/** 401 handling shared by JSON and streaming callers: bounce to login
 *  (replace, not href — a 401 page must not stay in history). Runs outside
 *  React components where useRouter is unavailable. */
export function redirectToLoginOn401(response: Response): void {
  if (response.status === 401 && typeof window !== "undefined") {
    const path = window.location.pathname;
    const isPublic = ["/login", "/accept-invite"].some((route) =>
      path.startsWith(route)
    );
    if (!isPublic) {
      window.location.replace(`/login?clear_session=1&next=${encodeURIComponent(path + window.location.search)}`);
    }
  }
}

/** Throw the backend error envelope as an `ApiError` (message + details
 *  preserved for problems[]/channel/422 selectors). Shared by apiClient and
 *  streaming callers that can't go through response.json()-shaped parsing. */
export async function throwApiError(response: Response): Promise<never> {
  const errorData = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  // New-arch envelope: { ok:false, detail, error:{ code, error_id, details } }.
  // Agent catalog 400s carry error.details.problems[] (spec 0022) — preserve
  // them on the thrown error instead of flattening to a string.
  const errorBlock =
    errorData.error && typeof errorData.error === "object"
      ? (errorData.error as Record<string, unknown>)
      : null;
  const detailsBlock =
    errorBlock?.details && typeof errorBlock.details === "object"
      ? (errorBlock.details as Record<string, unknown>)
      : null;
  let details: ApiErrorDetails | null = null;
  if (errorBlock || detailsBlock) {
    details = {
      ...(typeof errorBlock?.code === "string" ? { code: errorBlock.code } : {}),
      ...(typeof errorBlock?.error_id === "string" ? { errorId: errorBlock.error_id } : {}),
      ...(detailsBlock ? (detailsBlock as Record<string, unknown>) : {}),
    };
    const problems = (details as Record<string, unknown>).problems;
    if (problems !== undefined && !Array.isArray(problems)) {
      const { problems: _dropped, ...rest } = details as Record<string, unknown>;
      void _dropped;
      details = rest as ApiErrorDetails;
    }
  }
  const detail = Array.isArray(errorData.detail)
    ? errorData.detail.map((entry: { msg?: string }) => entry.msg ?? "Invalid request").join("; ")
    : errorData.detail;
  throw new ApiError(
    (typeof detail === "string" && detail) ||
      (typeof errorData.message === "string" && errorData.message) ||
      `API Error: ${response.statusText}`,
    response.status,
    details
  );
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  // Sessions ride an httpOnly cookie; include it on every API call.
  const response = await fetch(url, { ...options, headers, credentials: "include" });

  if (!response.ok) {
    redirectToLoginOn401(response);
    await throwApiError(response);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const json = await response.json();

  // Unwrap the new standard backend envelope ({ ok, data, message, meta }) if present
  if (json && typeof json === "object" && "ok" in json && "data" in json) {
    return json.data;
  }

  // Fallback for legacy endpoints returning flat structures
  return json;
}
