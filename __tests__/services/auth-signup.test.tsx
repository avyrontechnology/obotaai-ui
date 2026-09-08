import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useSignup } from "@/services/auth";

const fetchMock = jest.fn();

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

describe("useSignup", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    (globalThis as unknown as { fetch: unknown }).fetch = fetchMock;
  });

  afterEach(() => {
    delete (globalThis as unknown as { fetch?: unknown }).fetch;
  });

  it("strips confirm and posts the signup payload", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        user_id: "usr_1",
        email: "owner@company.com",
        name: null,
        role: "owner",
        org_id: "default",
        disabled: false,
        created_at: new Date().toISOString(),
        last_login_at: null,
      }),
    });
    const { result } = renderHook(() => useSignup(), { wrapper });
    let user: unknown;
    await act(async () => {
      user = await result.current.mutateAsync({
        email: "owner@company.com",
        password: "s3cure-pass",
        confirm: "s3cure-pass",
      });
    });
    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const sent = JSON.parse(options.body as string) as Record<string, unknown>;
    expect(sent).toEqual({ email: "owner@company.com", password: "s3cure-pass" });
    expect(user).toMatchObject({ user_id: "usr_1", role: "owner" });
  });
});
