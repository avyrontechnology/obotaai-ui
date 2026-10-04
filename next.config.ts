import type { NextConfig } from "next";

/**
 * Same-origin API proxy (optional). When the engine lives on another site
 * (e.g. UI on localhost / Vercel, API on engine.example.com), its httpOnly
 * session cookie is a third-party cookie and Brave / Chrome tracking
 * protection drop it — login "succeeds" and the next call 401s. Set the
 * server-only `API_PROXY_TARGET` to the engine origin and point
 * `NEXT_PUBLIC_API_BASE_URL` at this app's own `/api/v1`: the browser then
 * only talks to the UI origin, so the cookie is first-party.
 * Realtime sockets still connect straight to `NEXT_PUBLIC_WS_BASE_URL`
 * (authenticated by the single-use `?ticket=`, no cookie needed).
 */
const apiProxyTarget = process.env.API_PROXY_TARGET?.trim().replace(/\/+$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!apiProxyTarget) return [];
    return [{ source: "/api/v1/:path*", destination: `${apiProxyTarget}/api/v1/:path*` }];
  },
};

export default nextConfig;
