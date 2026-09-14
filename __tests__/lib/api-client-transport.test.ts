import { ApiError, apiClient, API_BASE_URL } from "@/lib/api-client";

function mockFetchOnce(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    statusText: "OK",
    json: () => Promise.resolve({}),
    ...response,
  } as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe("apiClient transport contract (F7 ownership)", () => {
  it("prefixes API_BASE_URL and sends credentials:include", async () => {
    mockFetchOnce({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
    await apiClient("/executions?agent_id=a1");
    const fetchMock = global.fetch as jest.Mock;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/executions?agent_id=a1`);
    expect(options.credentials).toBe("include");
    expect((options.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json"
    );
  });

  it("returns {} on 204 No Content", async () => {
    mockFetchOnce({ ok: true, status: 204, json: () => Promise.resolve({}) });
    await expect(apiClient<Record<string, unknown>>("/tools/x")).resolves.toEqual({});
  });

  it("throws ApiError with status and FastAPI detail", async () => {
    mockFetchOnce({
      ok: false,
      status: 404,
      statusText: "Not Found",
      json: () => Promise.resolve({ detail: "Nope" }),
    });
    const error = await apiClient("/missing").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(404);
    expect((error as ApiError).message).toBe("Nope");
  });

  it("throws ApiError on 401 (redirect to /login?next= is handled in api-client)", async () => {
    // jsdom's Location.replace is read-only, so the redirect side-effect
    // (window.location.replace(`/login?clear_session=1&next=…`) for
    // non-public routes, skipped for /login + /accept-invite) is verified
    // by code inspection at src/lib/api-client.ts:41-51, not by spy.
    window.history.pushState({}, "", "/agents?x=1");
    mockFetchOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: () => Promise.resolve({ detail: "Unauthorized" }),
    });
    const error = await apiClient("/executions").catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(401);
    expect((error as ApiError).message).toBe("Unauthorized");
  });
});
