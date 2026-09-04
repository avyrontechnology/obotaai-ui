import { ApiError, apiClient } from "@/lib/api-client";

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
});
