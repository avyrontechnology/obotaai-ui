/** env.ts validates at import time, so each case re-imports it in isolation. */
async function loadEnv(vars: Record<string, string | undefined>) {
  const saved = { ...process.env };
  Object.assign(process.env, vars);
  try {
    let mod: typeof import("@/lib/env") | undefined;
    await jest.isolateModulesAsync(async () => {
      mod = await import("@/lib/env");
    });
    return mod!.env;
  } finally {
    process.env = saved;
  }
}

describe("env", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("accepts an absolute API URL", async () => {
    expect((await loadEnv({ NEXT_PUBLIC_API_BASE_URL: "https://api.example.com/api/v1" })).NEXT_PUBLIC_API_BASE_URL).toBe(
      "https://api.example.com/api/v1"
    );
  });

  it("accepts a same-origin API path for the next.config proxy", async () => {
    expect((await loadEnv({ NEXT_PUBLIC_API_BASE_URL: "/api/v1" })).NEXT_PUBLIC_API_BASE_URL).toBe("/api/v1");
  });

  it("rejects protocol-relative and bare values", async () => {
    await expect(loadEnv({ NEXT_PUBLIC_API_BASE_URL: "//evil.com/api" })).rejects.toThrow(/Invalid environment variables/);
    await expect(loadEnv({ NEXT_PUBLIC_API_BASE_URL: "api/v1" })).rejects.toThrow(/Invalid environment variables/);
  });

  it("still requires an absolute websocket URL", async () => {
    await expect(loadEnv({ NEXT_PUBLIC_WS_BASE_URL: "/ws" })).rejects.toThrow(/Invalid environment variables/);
  });
});
