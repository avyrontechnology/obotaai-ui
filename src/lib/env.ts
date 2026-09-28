import { z } from "zod";

const FALLBACKS = {
  NEXT_PUBLIC_API_BASE_URL: "http://localhost:5001/api/v1",
  NEXT_PUBLIC_WS_BASE_URL: "ws://localhost:5001",
} as const;

// Production discipline: in prod builds a missing/invalid var fails loudly so
// a misconfigured deploy never ships (e.g. silently pointing at localhost).
// Local dev keeps localhost fallbacks so `next dev` works with zero setup.
// NOTE: NEXT_PUBLIC_* values are inlined into the client JS bundle — they are
// public config, never secrets. Real secrets must be server-only env vars
// (no NEXT_PUBLIC_ prefix) and never ship to the browser.
const isProd = process.env.NODE_ENV === "production";

const urlSchema = (fallback: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? undefined : v.trim()) : v),
    isProd ? z.string().url() : z.string().url().default(fallback)
  );

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: urlSchema(FALLBACKS.NEXT_PUBLIC_API_BASE_URL),
  NEXT_PUBLIC_WS_BASE_URL: urlSchema(FALLBACKS.NEXT_PUBLIC_WS_BASE_URL),
});

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_BASE_URL: process.env.NEXT_PUBLIC_WS_BASE_URL,
});

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors,
    "\nFix: set NEXT_PUBLIC_API_BASE_URL (e.g. https://<api-host>/api/v1) and NEXT_PUBLIC_WS_BASE_URL (e.g. wss://<api-host>) in your deployment environment (Vercel → Project → Settings → Environment Variables), then redeploy."
  );
  throw new Error(
    "Invalid environment variables: NEXT_PUBLIC_API_BASE_URL / NEXT_PUBLIC_WS_BASE_URL must be valid URLs"
  );
}

if (!isProd) {
  // Dev fallbacks must be visible, never silent.
  // NOTE: Must use literal keys — Next.js only inlines NEXT_PUBLIC_* vars
  // when accessed as process.env.NEXT_PUBLIC_FOO (not bracket notation).
  if (!process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) {
    console.warn(
      `[env] NEXT_PUBLIC_API_BASE_URL is unset — using dev fallback ${FALLBACKS.NEXT_PUBLIC_API_BASE_URL}`
    );
  }
  if (!process.env.NEXT_PUBLIC_WS_BASE_URL?.trim()) {
    console.warn(
      `[env] NEXT_PUBLIC_WS_BASE_URL is unset — using dev fallback ${FALLBACKS.NEXT_PUBLIC_WS_BASE_URL}`
    );
  }
}

export const env = parsedEnv.data;
