import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/accept-invite"];
const SESSION_COOKIE = "otoba_session";

/**
 * Session-presence gate. Validity is checked server-side on every API call
 * (401 → login redirect in api-client); middleware only keeps logged-out
 * visitors out of app routes without a round trip.
 */
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
