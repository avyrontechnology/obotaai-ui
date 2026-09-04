import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:5001"),
  NEXT_PUBLIC_WS_BASE_URL: z.string().url().default("ws://localhost:5001"),
});

const parsedEnv = envSchema.safeParse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_WS_BASE_URL: process.env.NEXT_PUBLIC_WS_BASE_URL,
});

if (!parsedEnv.success) {
  console.error(
    "Invalid environment variables:",
    parsedEnv.error.flatten().fieldErrors
  );
  throw new Error("Invalid environment variables");
}

export const env = parsedEnv.data;
