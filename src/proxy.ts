import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/accept-invite"];
const SESSION_COOKIE = "otoba_session";

/**
 * Session-presence gate. Validity is checked server-side on every API call
 * (401 → login redirect in api-client); middleware only keeps logged-out
 * visitors out of app routes without a round trip.
 *
 * Split-deployment guard: the session cookie is scoped to the API host. When
 * the UI is served from a different host (e.g. Vercel frontend + separate
 * API), this proxy can never see the cookie — enforcing the gate here would
 * bounce freshly logged-in users straight back to /login forever. In that
 * case we skip the presence redirect and let the client-side 401 handling
 * in api-client do the gating (it talks to the API host, so it sees auth).
 */
function isSameSiteDeployment(request: NextRequest): boolean {
  const raw = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!raw) return true;
  try {
    return new URL(raw).hostname === request.nextUrl.hostname;
  } catch {
    return true;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/brand") ||
    pathname === "/favicon.ico" ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const isPublic = PUBLIC_PATHS.some((route) => pathname.startsWith(route));
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  if (!isPublic && !hasSession && !isSameSiteDeployment(request)) {
    // Cross-site UI/API: the cookie check above can never pass here.
    // Render the route and let api-client's 401 → /login redirect decide.
    return NextResponse.next();
  }

  if (!isPublic && !hasSession) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", pathname + request.nextUrl.search);
    return NextResponse.redirect(login);
  }
  if (isPublic && hasSession && pathname !== "/accept-invite") {
    if (request.nextUrl.searchParams.get("clear_session")) {
      const response = NextResponse.next();
      response.cookies.delete(SESSION_COOKIE);
      return response;
    }
    return NextResponse.redirect(new URL("/", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
