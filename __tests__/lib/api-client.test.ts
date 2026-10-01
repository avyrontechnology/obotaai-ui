import {
  ApiError,
  agentChannelRejection,
  agentRequestErrors,
  agentValidationProblems,
  apiClient,
  buildTalkSocketUrl,
  wsCloseReason,
} from "@/lib/api-client";

function mockFetch(status: number, body: unknown, statusText = "Error") {
  global.fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    statusText,
    json: () =>
      body instanceof Error ? Promise.reject(body) : Promise.resolve(body),
  } as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("apiClient errors", () => {
  it("surfaces FastAPI string detail", async () => {
    mockFetch(409, { detail: "Batch is outside its calling hours" }, "Conflict");
    await expect(apiClient("/batches/x/start", { method: "POST" })).rejects.toThrow(
      new ApiError("Batch is outside its calling hours", 409)
    );
  });

  it("joins FastAPI validation error arrays", async () => {
    mockFetch(
      422,
      { detail: [{ msg: "Field required" }, { msg: "Too short" }] },
      "Unprocessable Entity"
    );
    await expect(apiClient("/batches", { method: "POST" })).rejects.toThrow(
      new ApiError("Field required; Too short", 422)
    );
  });

  it("falls back to message then status text", async () => {
    mockFetch(500, { message: "Boom" }, "Server Error");
    await expect(apiClient("/x")).rejects.toThrow(new ApiError("Boom", 500));

    mockFetch(500, {}, "Server Error");
    await expect(apiClient("/x")).rejects.toThrow(new ApiError("API Error: Server Error", 500));
  });

  it("returns parsed JSON on success", async () => {
    mockFetch(200, { ok: true });
    await expect(apiClient("/x")).resolves.toEqual({ ok: true });
  });

  it("preserves catalog 400 problems[] on the thrown error", async () => {
    // Backend spec 0022 envelope: { ok:false, detail, error:{ details:{ problems } } }.
    const problems = ["tasks[0].transcriber: unknown asr provider 'deepgrm' (valid: deepgram, openai)"];
    mockFetch(
      400,
      {
        ok: false,
        detail: problems.join("; "),
        error: { code: "invalid_request", error_id: "err_1", details: { problems } },
      },
      "Bad Request"
    );
    const failure = await apiClient("/agent/x").catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(ApiError);
    expect((failure as ApiError).details?.problems).toEqual(problems);
    expect(agentValidationProblems(failure)).toEqual(problems);
  });

  it("returns no problems for legacy errors without a details block", () => {
    expect(agentValidationProblems(new ApiError("nope", 500))).toEqual([]);
    expect(agentValidationProblems(new Error("nope"))).toEqual([]);
  });

  it("surfaces Phase A channel rejections outside problems[] (spec 0028)", async () => {
    mockFetch(
      400,
      {
        ok: false,
        detail: "Channels not servable yet: chat (valid: voice; chat arrives in Phase C).",
        error: {
          code: "invalid_request",
          error_id: "err_2",
          details: { channels: ["chat"], valid: ["voice"] },
        },
      },
      "Bad Request"
    );
    const failure = await apiClient("/agent/x").catch((e: unknown) => e);
    expect(agentValidationProblems(failure)).toEqual([]);
    expect(agentChannelRejection(failure)).toEqual({ channels: ["chat"], valid: ["voice"] });
    expect(agentChannelRejection(new ApiError("nope", 500))).toBeNull();
  });

  it("formats single-app 422 {loc, type} failures as path messages (spec 0052)", async () => {
    // Backend spec 0052: records carry only {loc, type} — no msg/input/ctx/url.
    mockFetch(
      422,
      {
        ok: false,
        detail: "Request validation failed",
        error: {
          code: "invalid_request",
          error_id: "err_3",
          details: {
            errors: [
              { loc: ["body", "channels"], type: "too_short" },
              { loc: ["body", "tasks", 0, "pipeline"], type: "literal_error" },
              { loc: ["query", "limit"], type: "missing" },
              { loc: ["body", "mystery"], type: "custom_wizard_error" },
              { type: "missing" },
              { loc: ["body", "note"] },
            ],
          },
        },
      },
      "Unprocessable Entity"
    );
    const failure = await apiClient("/agent").catch((e: unknown) => e);
    expect(agentRequestErrors(failure)).toEqual([
      "channels: Too short",
      "tasks.0.pipeline: Invalid value",
      "limit: Required",
      "mystery: custom_wizard_error",
      "Required",
    ]);
    expect(agentRequestErrors(new ApiError("nope", 500))).toEqual([]);
  });
});

describe("buildTalkSocketUrl", () => {
  it("targets the single-app socket with a ticket-only credential (specs 0021/0048/0054)", () => {
    // Single app: WS /api/v1/chat/v1/{agent_id} + ?ticket=. Bare /chat/v1 and
    // ?token= are retired — sending them gets the socket rejected pre-gate.
    const url = new URL(buildTalkSocketUrl("ws://localhost:5001", "agent-1", "tick_123"));
    expect(url.pathname).toBe("/api/v1/chat/v1/agent-1");
    expect(url.searchParams.get("ticket")).toBe("tick_123");
    expect(url.searchParams.get("token")).toBeNull();
    expect(url.searchParams.get("leg")).toBe("browser");
  });

  it("tolerates a trailing slash on the base URL", () => {
    const url = new URL(buildTalkSocketUrl("ws://localhost:5001/", "agent-1", "tick_123"));
    expect(url.pathname).toBe("/api/v1/chat/v1/agent-1");
  });

  it("omits auth params without a ticket (cookie fallback)", () => {
    const url = new URL(buildTalkSocketUrl("ws://localhost:5001", "agent-1"));
    expect(url.searchParams.get("ticket")).toBeNull();
    expect(url.searchParams.get("token")).toBeNull();
    expect(url.searchParams.get("leg")).toBe("browser");
    expect(url.pathname).toBe("/api/v1/chat/v1/agent-1");
  });
});

describe("wsCloseReason", () => {
  it("maps channel-owned close codes to dedicated copy", () => {
    expect(wsCloseReason(4401)).toMatch(/denied/i);
    expect(wsCloseReason(4403)).toMatch(/disabled/i);
    expect(wsCloseReason(4404)).toMatch(/not found/i);
  });

  it("returns null for normal closures", () => {
    expect(wsCloseReason(1000)).toBeNull();
    expect(wsCloseReason(1006)).toBeNull();
  });
});
