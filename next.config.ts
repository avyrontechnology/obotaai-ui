import type { NextConfig } from "next";

/**
 * Same-origin API proxy (on by default).
 *
 * The engine keeps the session in an httpOnly cookie on its own host. When the
 * UI runs on another site (localhost, Vercel), that cookie is third-party and
 * Brave / Chrome tracking protection drop it — login "succeeds", then
 * /auth/me and /wallet 401 and the app logs out.
 *
 * So when NEXT_PUBLIC_API_BASE_URL is an absolute URL (as on Vercel today),
 * the build:
 *   1. rewrites /api/v1/* on this app to that engine URL, and
 *   2. inlines NEXT_PUBLIC_API_BASE_URL as "/api/v1" for the bundle,
 * so the browser only ever talks to the UI origin and the cookie is
 * first-party. No deployment env change is needed.
 *
 * Realtime sockets still connect straight to NEXT_PUBLIC_WS_BASE_URL
 * (authenticated by the single-use ?ticket=, no cookie needed).
 * Set API_PROXY=off to call the engine directly instead.
 */
const API_PROXY_PATH = "/api/v1";

function resolveProxyTarget(): string | undefined {
  if (process.env.API_PROXY?.trim().toLowerCase() === "off") return undefined;
  const configured = process.env.NEXT_PUBLIC_API_BASE_URL?.trim().replace(/\/+$/, "");
  if (!configured) return undefined;
  try {
    const url = new URL(configured);
    return url.protocol === "http:" || url.protocol === "https:" ? configured : undefined;
  } catch {
    return undefined; // already a same-origin path (or invalid — env.ts reports it)
  }
}

const apiProxyTarget = resolveProxyTarget();

const nextConfig: NextConfig = {
  ...(apiProxyTarget ? { env: { NEXT_PUBLIC_API_BASE_URL: API_PROXY_PATH } } : {}),
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: `${API_PROXY_PATH}/:path*`, destination: `${apiProxyTarget}/:path*` }];
  },
};

export default nextConfig;
