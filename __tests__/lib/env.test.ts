import { z } from "zod";
import { env } from "@/lib/env";
import { API_BASE_URL, WS_BASE_URL, buildTalkSocketUrl } from "@/lib/api-client";

describe("env (F7 ownership)", () => {
  it("defaults to localhost:5001 when env vars are unset", () => {
    expect(env.NEXT_PUBLIC_API_BASE_URL).toBeDefined();
    expect(env.NEXT_PUBLIC_WS_BASE_URL).toBeDefined();
    // In the test env (no NEXT_PUBLIC_* set) Zod defaults apply.
    expect(API_BASE_URL).toBe("http://localhost:5001");
    expect(WS_BASE_URL).toBe("ws://localhost:5001");
  });

  it("rejects invalid URLs", () => {
    const schema = z.object({
      NEXT_PUBLIC_API_BASE_URL: z.string().url().default("http://localhost:5001"),
      NEXT_PUBLIC_WS_BASE_URL: z.string().url().default("ws://localhost:5001"),
    });
    expect(schema.safeParse({ NEXT_PUBLIC_API_BASE_URL: "not-a-url" }).success).toBe(false);
    expect(
      schema.safeParse({ NEXT_PUBLIC_WS_BASE_URL: "http://[invalid" }).success
    ).toBe(false);
  });
});

describe("buildTalkSocketUrl", () => {
  it("always carries ?leg=browser and appends a ticket token", () => {
    expect(buildTalkSocketUrl("ws://localhost:5001", "agent-1")).toBe(
      "ws://localhost:5001/chat/v1/agent-1?leg=browser"
    );
    expect(buildTalkSocketUrl("ws://localhost:5001", "agent-1", "tick-123")).toBe(
      "ws://localhost:5001/chat/v1/agent-1?leg=browser&token=tick-123"
    );
  });
});
