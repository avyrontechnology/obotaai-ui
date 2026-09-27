import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrgTeam } from "@/components/settings/org-team";

jest.mock("@/services/auth", () => ({
  useSession: () => ({
    data: {
      user: { user_id: "usr_owner", email: "owner@co.com", name: "Owner", role: "owner", org_id: "org_1" },
    },
  }),
  useUsers: () => ({
    data: [
      { user_id: "usr_owner", email: "owner@co.com", name: "Owner", role: "owner" },
      { user_id: "usr_1", email: "member@co.com", name: "Member", role: "member" },
    ],
    isLoading: false,
  }),
  useInvites: () => ({ data: [], isLoading: false }),
  useInviteUser: jest.fn(),
  useSetUserRole: () => ({ mutateAsync: jest.fn() }),
  useDeleteUser: () => ({ mutateAsync: jest.fn().mockResolvedValue(undefined) }),
}));

jest.mock("@/services/platform/subaccounts", () => ({
  useSubAccounts: () => ({ data: [], isLoading: false }),
  useCreateSubAccount: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
  useDeleteSubAccount: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
  useAddMember: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
  useRemoveMember: () => ({ mutate: jest.fn(), mutateAsync: jest.fn(), isPending: false }),
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

const mockUseInviteUser = jest.requireMock("@/services/auth").useInviteUser as jest.Mock;
const mockUseMyTeams = jest.requireMock("@/services/platform/identity").useMyTeams as jest.Mock;
const mockUseCreateTeam = jest.requireMock("@/services/platform/identity").useCreateTeam as jest.Mock;
const mockUseAddTeamMember = jest.requireMock("@/services/platform/identity").useAddTeamMember as jest.Mock;
const mockUseRemoveTeamMember = jest.requireMock("@/services/platform/identity")
  .useRemoveTeamMember as jest.Mock;

const TEAMS = [
  { team_id: "team_apac", org_id: "org_1", tenant_id: "hex", name: "support-apac", role: "admin" },
  { team_id: "team_emea", org_id: "org_1", tenant_id: "hex", name: "support-emea", role: "admin" },
];

const CREATED_INVITE = {
  invite_id: "inv_1",
  email: "new@co.com",
  role: "member",
  token: "tok_abc123456789",
  expires_at: "2030-01-01T00:00:00.000Z",
};

function mutationStub(overrides: { mutateAsync?: jest.Mock; mutate?: jest.Mock } = {}) {
  return {
    mutate: overrides.mutate ?? jest.fn(),
    mutateAsync: overrides.mutateAsync ?? jest.fn().mockResolvedValue({}),
    isPending: false,
  };
}

function renderTeam() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrgTeam />
    </QueryClientProvider>
  );
}

function inviteWith(impl: jest.Mock) {
  mockUseInviteUser.mockReturnValue({ mutateAsync: impl, isPending: false });
}

function grantWith(impl: jest.Mock) {
  mockUseAddTeamMember.mockReturnValue({ mutate: jest.fn(), mutateAsync: impl, isPending: false });
}

describe("OrgTeam invite-with-team-grant (spec 0041 Slice C)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMyTeams.mockReturnValue({ data: TEAMS, isLoading: false, error: null });
    mockUseCreateTeam.mockReturnValue(mutationStub());
    mockUseRemoveTeamMember.mockReturnValue(mutationStub());
    inviteWith(jest.fn().mockResolvedValue(CREATED_INVITE));
    grantWith(jest.fn().mockResolvedValue({ membership_id: "mem_1" }));
  });

  it("renders the optional team-grant select with teams from useMyTeams", () => {
    renderTeam();
    const select = screen.getByLabelText("Team grant (optional)");
    expect(select).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No team grant" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "support-apac" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "support-emea" })).toBeInTheDocument();
    expect(screen.getByText(/two steps, invite first/)).toBeInTheDocument();
  });

  it("invite-with-grant fires invite then membership add in order", async () => {
    const inviteMutateAsync = jest.fn().mockResolvedValue(CREATED_INVITE);
    const grantMutateAsync = jest.fn().mockResolvedValue({ membership_id: "mem_1" });
    inviteWith(inviteMutateAsync);
    grantWith(grantMutateAsync);
    renderTeam();

    fireEvent.change(screen.getByLabelText("Invite email"), { target: { value: "new@co.com" } });
    fireEvent.change(screen.getByLabelText("Team grant (optional)"), { target: { value: "team_apac" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(inviteMutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(grantMutateAsync).toHaveBeenCalledTimes(1));

    expect(inviteMutateAsync).toHaveBeenCalledWith({ email: "new@co.com", role: "member" });
    expect(grantMutateAsync).toHaveBeenCalledWith({
      teamId: "team_apac",
      input: { user_id: "new@co.com", role: "member" },
    });
    expect(inviteMutateAsync.mock.invocationCallOrder[0]).toBeLessThan(
      grantMutateAsync.mock.invocationCallOrder[0]
    );
    // The invite result survives alongside the grant notice.
    expect(await screen.findByText(/Invite for new@co\.com/)).toBeInTheDocument();
    expect(await screen.findByText(/second step done/)).toBeInTheDocument();
  });

  it("invite-without-grant fires invite only", async () => {
    const inviteMutateAsync = jest.fn().mockResolvedValue(CREATED_INVITE);
    const grantMutateAsync = jest.fn().mockResolvedValue({ membership_id: "mem_1" });
    inviteWith(inviteMutateAsync);
    grantWith(grantMutateAsync);
    renderTeam();

    fireEvent.change(screen.getByLabelText("Invite email"), { target: { value: "new@co.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(inviteMutateAsync).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByText(/Invite for new@co\.com/)).toBeInTheDocument()
    );
    expect(grantMutateAsync).not.toHaveBeenCalled();
  });

  it("grant failure surfaces without losing the invite result", async () => {
    const inviteMutateAsync = jest.fn().mockResolvedValue(CREATED_INVITE);
    const grantMutateAsync = jest.fn().mockRejectedValue(new Error("grant boom"));
    inviteWith(inviteMutateAsync);
    grantWith(grantMutateAsync);
    renderTeam();

    fireEvent.change(screen.getByLabelText("Invite email"), { target: { value: "new@co.com" } });
    fireEvent.change(screen.getByLabelText("Team grant (optional)"), { target: { value: "team_emea" } });
    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    await waitFor(() => expect(grantMutateAsync).toHaveBeenCalledTimes(1));
    // Invite link still shown even though the grant failed.
    expect(await screen.findByText(/Invite for new@co\.com/)).toBeInTheDocument();
    expect(await screen.findByText(/team grant failed/)).toBeInTheDocument();
    expect(screen.getByText(/Finish it from Teams after they accept/)).toBeInTheDocument();
  });

  it("preserves invite validation — empty email calls nothing", () => {
    const inviteMutateAsync = jest.fn().mockResolvedValue(CREATED_INVITE);
    const grantMutateAsync = jest.fn().mockResolvedValue({ membership_id: "mem_1" });
    inviteWith(inviteMutateAsync);
    grantWith(grantMutateAsync);
    renderTeam();

    fireEvent.click(screen.getByRole("button", { name: "Invite" }));

    expect(screen.getByText("Enter an email address.")).toBeInTheDocument();
    expect(inviteMutateAsync).not.toHaveBeenCalled();
    expect(grantMutateAsync).not.toHaveBeenCalled();
  });
});
