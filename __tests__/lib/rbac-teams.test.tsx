import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { ApiError } from "@/lib/api-client";
import {
  isSuspendedWorkspace,
  isUnauthorizedError,
  minRoleFor,
  roleCan,
  sessionTeamRoles,
  teamRoleFor,
  useSuspendedWorkspace,
  useTeamRole,
  type Action,
} from "@/lib/rbac";
import { SuspendedWorkspaceBanner } from "@/components/layout/app-shell";
import LoginPage from "@/app/login/page";
import type { Role } from "@/lib/schemas/auth";

/** Spec 0041 Slice B (Dev B): suspended UX + team-aware gating.
 *
 *  Service boundaries are mocked (useSession/useMyTeams/useLogout) so the
 *  real rbac logic + banner wiring run without a backend. Global gates are
 *  pinned byte-for-byte: no existing gate may get stricter.
 */

const mockUseSession = jest.fn();
const mockUseLogout = jest.fn();
const mockUseLogin = jest.fn();
jest.mock("@/services/auth", () => ({
  useSession: (...args: unknown[]) => mockUseSession(...args),
  useLogout: (...args: unknown[]) => mockUseLogout(...args),
  useLogin: (...args: unknown[]) => mockUseLogin(...args),
}));

const mockUseMyTeams = jest.fn();
jest.mock("@/services/platform/identity", () => ({
  useMyTeams: (...args: unknown[]) => mockUseMyTeams(...args),
}));

jest.mock("@/services/api", () => ({ useAgents: () => ({ data: [] }) }));
jest.mock("@/services/platform/wallet", () => ({ useWallet: () => ({ data: undefined }) }));
jest.mock("@/services/health", () => ({ useEngineHealth: () => ({ isPending: true }) }));

let mockSearchParams = "";
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock("next/navigation", () => ({
  usePathname: () => "/agents",
  useRouter: () => ({ push: mockPush, refresh: jest.fn(), replace: mockReplace }),
  useSearchParams: () => new URLSearchParams(mockSearchParams),
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: jest.fn() }),
}));

const SESSION = {
  user: {
    user_id: "usr_1",
    email: "owner@company.com",
    name: "Owner",
    role: "owner" as Role,
    org_id: "org_1",
    tenant_id: "68d5f4a1b2c3d4e5f6071829",
    disabled: false,
    created_at: "2026-01-01T00:00:00Z",
    last_login_at: null,
  },
  scopes: [],
};

const TEAMS = [
  {
    team_id: "team_support",
    org_id: "org_1",
    tenant_id: "68d5f4a1b2c3d4e5f6071829",
    name: "support",
    role: "admin" as Role,
  },
  {
    team_id: "team_plain",
    org_id: "org_1",
    tenant_id: "68d5f4a1b2c3d4e5f6071829",
    name: "plain",
  },
];

const UNAUTH = () => new ApiError("Unauthorized", 401);

function mockQueryStates(session: unknown, teams: unknown) {
  mockUseSession.mockReturnValue(session);
  mockUseMyTeams.mockReturnValue(teams);
}

function sessionState(data: unknown, error: unknown = null) {
  return { data, error };
}

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSearchParams = "";
  // Auth hand-off cookies (suspended / return-to) must not leak between tests.
  ["otoba_suspended", "otoba_signed_out", "otoba_return_to"].forEach((name) => {
    document.cookie = `${name}=; Path=/; Max-Age=0`;
  });
  mockQueryStates(sessionState(undefined), { data: undefined, error: null });
  mockUseLogout.mockReturnValue({ mutate: jest.fn(), isPending: false });
  mockUseLogin.mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
  // Page renders (login) assume a backend; keep them offline like the
  // signup-page suite does.
  (globalThis as unknown as { fetch: unknown }).fetch = jest
    .fn()
    .mockRejectedValue(new Error("no backend"));
});

afterEach(() => {
  delete (globalThis as unknown as { fetch?: unknown }).fetch;
});

/** The shipped MIN_ROLE table, pinned key-for-key (spec 0041: unchanged). */
const PINNED_MIN_ROLE: Record<Action, Role> = {
  "agents.write": "member",
  "agents.delete": "member",
  "calls.simulate": "member",
  "calls.live": "member",
  "batches.write": "member",
  "library.import": "member",
  "graphs.write": "member",
  "workflows.write": "member",
  "settings.write": "admin",
  "team.manage": "admin",
  "keys.manage": "admin",
  "billing.manage": "admin",
  "workspace.reset": "owner",
};

describe("global gates unchanged", () => {
  it("pins the existing MIN_ROLE table for every action", () => {
    for (const [action, role] of Object.entries(PINNED_MIN_ROLE) as [Action, Role][]) {
      expect(minRoleFor(action)).toBe(role);
    }
  });

  it("keeps roleCan semantics for every role x action", () => {
    const rank: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };
    for (const role of ["viewer", "member", "admin", "owner"] as const) {
      for (const [action, min] of Object.entries(PINNED_MIN_ROLE) as [Action, Role][]) {
        expect(roleCan(role, action)).toBe(rank[role] >= rank[min]);
      }
    }
    for (const action of Object.keys(PINNED_MIN_ROLE) as Action[]) {
      expect(roleCan(undefined, action)).toBe(false);
    }
  });
});

describe("isUnauthorizedError", () => {
  it("matches 401 ApiErrors only (a 401 is a 401)", () => {
    expect(isUnauthorizedError(UNAUTH())).toBe(true);
    expect(isUnauthorizedError(new ApiError("Forbidden", 403))).toBe(false);
    expect(isUnauthorizedError(new ApiError("Not Found", 404))).toBe(false);
    expect(isUnauthorizedError(new ApiError("Server Error", 500))).toBe(false);
    expect(isUnauthorizedError(new Error("Unauthorized"))).toBe(false);
    expect(isUnauthorizedError(null)).toBe(false);
    expect(isUnauthorizedError(undefined)).toBe(false);
  });
});

describe("sessionTeamRoles", () => {
  it("reads a top-level team_roles map", () => {
    expect(sessionTeamRoles({ team_roles: { t1: "admin" } })).toEqual({ t1: "admin" });
  });

  it("reads a user-nested team_roles map", () => {
    expect(sessionTeamRoles({ user: { team_roles: { t1: "member" } } })).toEqual({ t1: "member" });
  });

  it("drops unknown role values and degrades bad shapes to undefined", () => {
    expect(sessionTeamRoles({ team_roles: { t1: "superadmin", t2: "member" } })).toEqual({
      t2: "member",
    });
    expect(sessionTeamRoles({ team_roles: { t1: "nope" } })).toBeUndefined();
    expect(sessionTeamRoles({})).toBeUndefined();
    expect(sessionTeamRoles({ team_roles: ["admin"] })).toBeUndefined();
    expect(sessionTeamRoles(null)).toBeUndefined();
    expect(sessionTeamRoles("admin")).toBeUndefined();
  });
});

describe("teamRoleFor (pure)", () => {
  it("prefers the session team_roles map over membership rows", () => {
    expect(teamRoleFor(TEAMS, "team_support", { team_support: "member" })).toBe("member");
  });

  it("falls back to the membership row role", () => {
    expect(teamRoleFor(TEAMS, "team_support")).toBe("admin");
  });

  it("returns undefined for unknown teams, missing rows, and empty ids", () => {
    expect(teamRoleFor(TEAMS, "team_nope")).toBeUndefined();
    expect(teamRoleFor(TEAMS, "team_plain")).toBeUndefined();
    expect(teamRoleFor(undefined, "team_support")).toBeUndefined();
    expect(teamRoleFor(TEAMS, undefined)).toBeUndefined();
    expect(teamRoleFor(TEAMS, "")).toBeUndefined();
  });
});

describe("useTeamRole", () => {
  it("reads the membership row from useMyTeams", () => {
    mockQueryStates(sessionState(SESSION), { data: TEAMS, error: null });
    const { result } = renderHook(() => useTeamRole("team_support"));
    expect(result.current).toBe("admin");
  });

  it("returns undefined for teams the caller is not on", () => {
    mockQueryStates(sessionState(SESSION), { data: TEAMS, error: null });
    const { result } = renderHook(() => useTeamRole("team_nope"));
    expect(result.current).toBeUndefined();
  });

  it("prefers the session team_roles map when the session carries it", () => {
    mockQueryStates(sessionState({ ...SESSION, team_roles: { team_support: "viewer" } }), {
      data: TEAMS,
      error: null,
    });
    const { result } = renderHook(() => useTeamRole("team_support"));
    expect(result.current).toBe("viewer");
  });

  it("stays disabled without a session (no probing while logged out)", () => {
    mockQueryStates(sessionState(undefined), { data: undefined, error: null });
    const { result } = renderHook(() => useTeamRole("team_support"));
    expect(result.current).toBeUndefined();
    expect(mockUseMyTeams).toHaveBeenCalledWith(false);
  });
});

describe("isSuspendedWorkspace (pure)", () => {
  it("needs a last-known session AND repeated 401s", () => {
    expect(
      isSuspendedWorkspace({ hasLastKnownSession: true, sessionUnauthorized: true, teamsUnauthorized: true })
    ).toBe(true);
    expect(
      isSuspendedWorkspace({ hasLastKnownSession: true, sessionUnauthorized: true, teamsUnauthorized: false })
    ).toBe(false);
    expect(
      isSuspendedWorkspace({ hasLastKnownSession: true, sessionUnauthorized: false, teamsUnauthorized: true })
    ).toBe(false);
    expect(
      isSuspendedWorkspace({ hasLastKnownSession: true, sessionUnauthorized: false, teamsUnauthorized: false })
    ).toBe(false);
    // Same 401s with no last-known session mean logged-out, not suspended.
    expect(
      isSuspendedWorkspace({ hasLastKnownSession: false, sessionUnauthorized: true, teamsUnauthorized: true })
    ).toBe(false);
  });
});

describe("useSuspendedWorkspace", () => {
  it("is false for a healthy signed-in session", () => {
    mockQueryStates(sessionState(SESSION), { data: TEAMS, error: null });
    const { result } = renderHook(() => useSuspendedWorkspace());
    expect(result.current).toBe(false);
  });

  it("is false while logged out (401s without a last-known session)", () => {
    mockQueryStates(sessionState(undefined, UNAUTH()), { data: undefined, error: null });
    const { result } = renderHook(() => useSuspendedWorkspace());
    expect(result.current).toBe(false);
  });

  it("is false on a single stray 401 (needs repeated 401s)", () => {
    mockQueryStates(sessionState(SESSION, UNAUTH()), { data: TEAMS, error: null });
    const { result } = renderHook(() => useSuspendedWorkspace());
    expect(result.current).toBe(false);
  });

  it("is true with a last-known session plus 401s on session-scoped queries", () => {
    mockQueryStates(sessionState(SESSION, UNAUTH()), { data: undefined, error: UNAUTH() });
    const { result } = renderHook(() => useSuspendedWorkspace());
    expect(result.current).toBe(true);
  });
});

describe("SuspendedWorkspaceBanner", () => {
  it("renders nothing when the workspace is healthy", () => {
    mockQueryStates(sessionState(SESSION), { data: TEAMS, error: null });
    const { container } = render(<SuspendedWorkspaceBanner />, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while logged out", () => {
    mockQueryStates(sessionState(undefined, UNAUTH()), { data: undefined, error: UNAUTH() });
    const { container } = render(<SuspendedWorkspaceBanner />, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the suspended alert plus a sign-out action (no redirect on its own)", () => {
    const mutate = jest.fn();
    mockUseLogout.mockReturnValue({ mutate, isPending: false });
    mockQueryStates(sessionState(SESSION, UNAUTH()), { data: undefined, error: UNAUTH() });
    render(<SuspendedWorkspaceBanner />, { wrapper });
    expect(screen.getByTestId("suspended-workspace-banner")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(/workspace suspended/i);
    expect(screen.getByRole("alert")).toHaveTextContent(/contact your owner/i);
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
    // Banner never redirects by itself — no login-redirect loop.
    expect(mockReplace).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("signs out client-side when the logout call itself 401s", () => {
    const clear = jest.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.clear = clear;
    mockUseLogout.mockReturnValue({
      mutate: (_vars: unknown, options?: { onError?: (error: unknown) => void }) =>
        options?.onError?.(UNAUTH()),
      isPending: false,
    });
    mockQueryStates(sessionState(SESSION, UNAUTH()), { data: undefined, error: UNAUTH() });
    render(
      <QueryClientProvider client={client}>
        <SuspendedWorkspaceBanner />
      </QueryClientProvider>
    );
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    expect(clear).toHaveBeenCalledTimes(1);
    // Single replace to login — never a redirect loop.
    expect(mockReplace).toHaveBeenCalledTimes(1);
    // Clean URL — the suspended notice rides in a one-shot cookie.
    expect(mockReplace).toHaveBeenCalledWith("/login");
    expect(document.cookie).toContain("otoba_suspended=1");
  });
});

describe("login suspended copy", () => {
  it("shows no workspace notice by default and never redirects on render", async () => {
    render(<LoginPage />);
    await act(async () => {});
    expect(screen.queryByTestId("workspace-suspended-notice")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("explains suspension when the suspended banner signed the user out", async () => {
    document.cookie = "otoba_suspended=1; Path=/";
    render(<LoginPage />);
    await act(async () => {});
    const notice = screen.getByTestId("workspace-suspended-notice");
    expect(notice).toHaveTextContent(/workspace is suspended/i);
    expect(notice).toHaveTextContent(/contact your owner/i);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("shows no notice on a plain sign-out / api-client 401 bounce", async () => {
    document.cookie = "otoba_signed_out=1; Path=/";
    document.cookie = "otoba_return_to=%2Fagents; Path=/";
    render(<LoginPage />);
    await act(async () => {});
    expect(screen.queryByTestId("workspace-suspended-notice")).not.toBeInTheDocument();
    expect(screen.queryByText(/you were signed out/i)).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("returns to the remembered page after login, with a clean URL", async () => {
    document.cookie = "otoba_return_to=%2Fagents; Path=/";
    const mutateAsync = jest.fn().mockResolvedValue({});
    mockUseLogin.mockReturnValue({ mutateAsync, isPending: false });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText("you@company.com"), { target: { value: "a@b.co" } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: "longenough1" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    });
    expect(mockPush).toHaveBeenCalledWith("/agents");
    expect(document.cookie).not.toContain("otoba_return_to=");
  });
});
