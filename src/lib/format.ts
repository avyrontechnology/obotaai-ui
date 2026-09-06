/** Compact relative time, e.g. "5m ago". Pure functions, tested. */
export function timeAgo(iso: string, nowMs = Date.now()): string {
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) return "—";
  const seconds = Math.max(0, Math.floor((nowMs - parsed) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function formatLatency(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "—";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * Display label for a call participant number. The backend sends the literal
 * string "unknown" (and sometimes null/blank) for inbound calls without
 * caller ID — never show that raw to users.
 */
export function displayCallerNumber(value: string | null | undefined, fallback = "—"): string {
  if (!value) return fallback;
  const trimmed = value.trim();
  if (trimmed === "" || trimmed.toLowerCase() === "unknown") return fallback;
  return trimmed;
}
