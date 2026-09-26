import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  identityKeys,
  useAddTeamMember,
  useCreateTeam,
  useMyTeams,
  useRemoveTeamMember,
} from "@/services/platform/identity";
import { apiClient, ApiError } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

const TEAM_ROW = {
  team_id: "team_abc123def456",
  org_id: "org_abc123def456",
  tenant_id: "68d5f4a1b2c3d4e5f6071829",
  name: "support-apac",
};

const MEMBERSHIP_ROW = {
  membership_id: "mem_abc123def456",
  user_id: "usr_1",
  team_id: "team_abc123def456",
  org_id: "org_abc123def456",
  tenant_id: "68d5f4a1b2c3d4e5f6071829",
  role: "member",
};

describe("identity hooks (specs 0040 + 0041)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("exposes stable query keys", () => {
    expect(identityKeys.all).toEqual(["identity"]);
    expect(identityKeys.myTeams).toEqual(["identity", "my-teams"]);
  });

  it("lists the caller's teams", async () => {
    mockedApiClient.mockResolvedValue([{ ...TEAM_ROW, role: "admin" }]);
    const { result } = renderHook(() => useMyTeams(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedApiClient).toHaveBeenCalledWith("/auth/me/teams");
    expect(result.current.data?.[0].role).toBe("admin");
  });

  it("stays disabled when told to", () => {
    const { result } = renderHook(() => useMyTeams(false), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedApiClient).not.toHaveBeenCalled();
  });

  it("propagates 403/404 for the backend-missing and forbidden notices", async () => {
    mockedApiClient.mockRejectedValueOnce(new ApiError("Forbidden", 403));
    const { result: forbidden } = renderHook(() => useMyTeams(), { wrapper });
    await waitFor(() => expect(forbidden.current.isError).toBe(true));
    expect(forbidden.current.error).toBeInstanceOf(ApiError);

    mockedApiClient.mockRejectedValueOnce(new ApiError("Not Found", 404));
    const { result: missing } = renderHook(() => useMyTeams(), { wrapper });
    await waitFor(() => expect(missing.current.isError).toBe(true));
    expect((missing.current.error as ApiError).status).toBe(404);
  });

  it("creates teams under the acting org", async () => {
    mockedApiClient.mockResolvedValue(TEAM_ROW);
    const { result } = renderHook(() => useCreateTeam(), { wrapper });
    let created: unknown;
    await React.act(async () => {
      created = await result.current.mutateAsync({ org_id: "org_abc123def456", name: "support-apac" });
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/auth/teams",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ org_id: "org_abc123def456", name: "support-apac" }),
      })
    );
    expect(created).toEqual(expect.objectContaining({ team_id: "team_abc123def456" }));
  });

  it("grants and revokes memberships, surfacing 409 duplicates", async () => {
    mockedApiClient.mockResolvedValue(MEMBERSHIP_ROW);
    const { result: granter } = renderHook(() => useAddTeamMember(), { wrapper });
    await React.act(async () => {
      await granter.current.mutateAsync({ teamId: "team_abc123def456", input: { user_id: "usr_1", role: "member" } });
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/auth/teams/team_abc123def456/members",
      expect.objectContaining({ method: "POST" })
    );

    mockedApiClient.mockRejectedValueOnce(new ApiError("Conflict", 409));
    const { result: dupe } = renderHook(() => useAddTeamMember(), { wrapper });
    const failure = await React.act(async () =>
      dupe.current.mutateAsync({ teamId: "team_abc123def456", input: { user_id: "usr_1" } }).catch((e: unknown) => e)
    );
    expect((failure as ApiError).status).toBe(409);

    mockedApiClient.mockResolvedValue({ ok: true });
    const { result: revoker } = renderHook(() => useRemoveTeamMember(), { wrapper });
    let removed: unknown;
    await React.act(async () => {
      removed = await revoker.current.mutateAsync({ teamId: "team_abc123def456", userId: "usr_1" });
    });
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/auth/teams/team_abc123def456/members/usr_1",
      expect.objectContaining({ method: "DELETE" })
    );
    expect(removed).toBe("usr_1");
  });
});
