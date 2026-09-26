import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrgTeam } from "@/components/settings/org-team";
import { ApiError } from "@/lib/api-client";

jest.mock("@/services/auth", () => ({
  useSession: () => ({
    data: { user: { user_id: "usr_owner", email: "owner@co.com", name: "Owner", role: "owner", org_id: "org_1" } },
  }),
  useUsers: () => ({
    data: [
      { user_id: "usr_owner", email: "owner@co.com", name: "Owner", role: "owner" },
      { user_id: "usr_1", email: "member@co.com", name: "Member", role: "member" },
    ],
    isLoading: false,
  }),
  useInvites: () => ({ data: [], isLoading: false }),
  useInviteUser: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useSetUserRole: () => ({ mutateAsync: jest.fn() }),
  useDeleteUser: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock("@/services/platform/subaccounts", () => ({
  useSubAccounts: () => ({ data: [], isLoading: false }),
  useCreateSubAccount: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteSubAccount: () => ({ mutateAsync: jest.fn() }),
  useAddMember: () => ({ mutateAsync: jest.fn() }),
  useRemoveMember: () => ({ mutateAsync: jest.fn() }),
}));

jest.mock("@/services/platform/identity", () => ({
  useMyTeams: jest.fn(),
  useCreateTeam: jest.fn(),
  useAddTeamMember: jest.fn(),
  useRemoveTeamMember: jest.fn(),
}));

jest.mock("@/lib/rbac", () => ({
  useCan: () => true,
  minRoleFor: () => "admin",
}));

const mockUseMyTeams = jest.requireMock("@/services/platform/identity").useMyTeams as jest.Mock;
const mockUseCreateTeam = jest.requireMock("@/services/platform/identity").useCreateTeam as jest.Mock;
const mockUseAddTeamMember = jest.requireMock("@/services/platform/identity").useAddTeamMember as jest.Mock;
const mockUseRemoveTeamMember = jest.requireMock("@/services/platform/identity").useRemoveTeamMember as jest.Mock;

type MutateOpts = { onSuccess?: () => void; onError?: (e: unknown) => void };

function mutationStub() {
  return {
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  };
}

/** Callback-style mutate stub that routes to onSuccess/onError like react-query. */
function callbackStub(behavior: { ok: true } | { ok: false; error: unknown }) {
  return {
    mutate: jest.fn((input: unknown, opts?: MutateOpts) => {
      if (behavior.ok) opts?.onSuccess?.();
      else opts?.onError?.(behavior.error);
    }),
    mutateAsync: jest.fn(),
    isPending: false,
  };
}

const TEAM_ROW = {
  team_id: "team_abc123def456",
  org_id: "org_1",
  tenant_id: "hex",
  name: "support-apac",
  role: "admin",
};

function renderTeam() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrgTeam />
    </QueryClientProvider>
  );
}

describe("OrgTeam identity section (specs 0040 + 0041)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMyTeams.mockReturnValue({ data: [TEAM_ROW], isLoading: false, error: null });
    mockUseCreateTeam.mockReturnValue(mutationStub());
    mockUseAddTeamMember.mockReturnValue(mutationStub());
    mockUseRemoveTeamMember.mockReturnValue(mutationStub());
  });

  it("lists my teams with the caller grant badge", () => {
    renderTeam();
    expect(screen.getByText("support-apac")).toBeInTheDocument();
    expect(screen.getByTitle("Your grant on this team")).toHaveTextContent("admin");
  });

  it("creates a team under the acting org", async () => {
    const mutate = jest.fn((_input: unknown, opts?: MutateOpts) => opts?.onSuccess?.());
    mockUseCreateTeam.mockReturnValue({ mutate, mutateAsync: jest.fn(), isPending: false });
    renderTeam();

    fireEvent.change(screen.getByLabelText("New team name"), { target: { value: "support-emea" } });
    fireEvent.click(screen.getByRole("button", { name: "Create team" }));

    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { org_id: "org_1", name: "support-emea" },
        expect.objectContaining({})
      )
    );
  });

  it("surfaces duplicate grants inline instead of a dead form", async () => {
    mockUseAddTeamMember.mockReturnValue(
      callbackStub({ ok: false, error: new ApiError("Conflict", 409) })
    );
    renderTeam();

    fireEvent.change(screen.getByLabelText("User to grant on support-apac"), {
      target: { value: "usr_1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Grant" }));

    expect(await screen.findByText("Already a member of this team.")).toBeInTheDocument();
  });

  it("removes members and shows the backend-missing notice on 404", async () => {
    const mutate = jest.fn((_input: unknown, opts?: MutateOpts) => opts?.onSuccess?.());
    mockUseRemoveTeamMember.mockReturnValue({ mutate, mutateAsync: jest.fn(), isPending: false });
    renderTeam();

    fireEvent.change(screen.getByLabelText("User to remove from support-apac"), {
      target: { value: "usr_1" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(mutate).toHaveBeenCalledWith(
        { teamId: "team_abc123def456", userId: "usr_1" },
        expect.objectContaining({})
      )
    );
    expect(await screen.findByText(/Removed from support-apac/)).toBeInTheDocument();

    mockUseMyTeams.mockReturnValue({ data: undefined, isLoading: false, error: new ApiError("Not Found", 404) });
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <OrgTeam />
      </QueryClientProvider>
    );
    expect(await screen.findByText(/unavailable on this backend/)).toBeInTheDocument();
  });
});
