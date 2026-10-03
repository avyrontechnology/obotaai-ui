/**
 * Auth routing without query strings: auth URLs stay clean (`/login`,
 * `/signup`). Hand-off state that used to ride in `?next=` /
 * `?clear_session=1` / `?suspended=1` travels in short-lived, first-party
 * cookies instead — readable by both the edge proxy and the browser.
 * None of these is a credential (the session cookie stays httpOnly).
 */

/** Routes that render without a session (chromeless, no login bounce). */
export const PUBLIC_AUTH_PATHS = ["/login", "/signup", "/accept-invite"] as const;

export function isPublicAuthPath(pathname: string): boolean {
  return PUBLIC_AUTH_PATHS.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

/** Where to land after signing in (set by the proxy / 401 bounce). */
export const RETURN_TO_COOKIE = "otoba_return_to";
/** Set right before a 401 bounce so the proxy drops the stale session
 *  cookie instead of redirecting /login → / (which would loop). */
export const SIGNED_OUT_COOKIE = "otoba_signed_out";
/** Set when the suspended-workspace banner signs the user out. */
export const SUSPENDED_COOKIE = "otoba_suspended";

const HANDOFF_MAX_AGE_S = 10 * 60;

/** Only same-origin, non-auth app paths are valid return targets. */
export function sanitizeReturnTo(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  const pathname = value.split(/[?#]/, 1)[0];
  if (isPublicAuthPath(pathname)) return null;
  return value;
}

/* ---- Browser-side helpers (no-ops on the server) ---- */

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  if (!match) return null;
  try {
    return decodeURIComponent(match.slice(name.length + 1));
  } catch {
    return null;
  }
}

function writeCookie(name: string, value: string, maxAgeS = HANDOFF_MAX_AGE_S): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeS}; SameSite=Lax`;
}

function clearCookie(name: string): void {
  writeCookie(name, "", 0);
}

/** Mark a 401 bounce: remember the current page and flag the stale session. */
export function markSignedOut(returnTo: string): void {
  const safe = sanitizeReturnTo(returnTo);
  if (safe) writeCookie(RETURN_TO_COOKIE, safe);
  writeCookie(SIGNED_OUT_COOKIE, "1");
}

export function markSuspended(): void {
  writeCookie(SUSPENDED_COOKIE, "1");
}

export function hasSuspendedFlag(): boolean {
  return readCookie(SUSPENDED_COOKIE) === "1";
}

/** Read and clear the post-login destination (defaults to the dashboard),
 *  and clear the one-shot suspended notice. Call after a successful login. */
export function consumeLoginHandoff(): string {
  const target = sanitizeReturnTo(readCookie(RETURN_TO_COOKIE)) ?? "/";
  clearCookie(RETURN_TO_COOKIE);
  clearCookie(SUSPENDED_COOKIE);
  return target;
}
