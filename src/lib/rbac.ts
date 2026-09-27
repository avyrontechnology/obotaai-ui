"use client";

import { useSession } from "@/services/auth";
import { useMyTeams } from "@/services/platform/identity";
import { ApiError } from "@/lib/api-client";
import type { Role } from "@/lib/schemas/auth";
import type { TeamWithRole } from "@/lib/schemas/identity";

/**
 * Frontend mirror of the backend role model (ROLE_SCOPES in
 * voiceai/platform/models.py). UI gating only — every action is
 * re-checked server-side. Keep the two in sync.
 */

export const ROLE_RANK: Record<Role, number> = { viewer: 0, member: 1, admin: 2, owner: 3 };

export type Action =
  | "agents.write"
  | "agents.delete"
  | "calls.simulate"
  | "calls.live"
  | "batches.write"
  | "library.import"
  | "graphs.write"
  | "workflows.write"
  | "settings.write"
  | "team.manage"
  | "keys.manage"
  | "billing.manage"
  | "workspace.reset";

const MIN_ROLE: Record<Action, Role> = {
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

export function roleCan(role: Role | undefined, action: Action): boolean {
  if (!role) return false;
  return (ROLE_RANK[role] ?? -1) >= ROLE_RANK[MIN_ROLE[action]];
}

/** Current session role (undefined while loading/logged out). */
export function useRole(): Role | undefined {
  const { data } = useSession();
  return data?.user.role;
}

/** Whether the signed-in user may perform the action. False while loading. */
export function useCan(action: Action): boolean {
  return roleCan(useRole(), action);
}

/** Minimum role label for tooltips/empty states. */
export function minRoleFor(action: Action): Role {
  return MIN_ROLE[action];
}

/* Spec 0041 Slice B — team-aware gating + suspended-workspace detection.
 * Additive only: every gate above is untouched. UI gating only — the
 * backend re-checks every action server-side, so team grants here never
 * widen global gates.
 */

/** A 401 from the API client. Suspended tenants resolve to no principal,
 *  so at the wire level a 401 is a 401 — the UI never probes the backend
 *  to distinguish suspended from logged-out.
 */
export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/** Read the optional `team_roles` map from the session payload when the
 *  backend carries it (top-level or nested under `user`). Unknown shapes
 *  degrade to undefined — never throws. Values outside the role set are
 *  dropped.
 */
export function sessionTeamRoles(session: unknown): Record<string, Role> | undefined {
  if (!session || typeof session !== "object") return undefined;
  const record = session as Record<string, unknown>;
  const user = record.user;
  const carried =
    record.team_roles ??
    (user && typeof user === "object" ? (user as Record<string, unknown>).team_roles : undefined);
  if (!carried || typeof carried !== "object" || Array.isArray(carried)) return undefined;
  let found = false;
  const roles: Record<string, Role> = {};
  for (const [teamId, role] of Object.entries(carried as Record<string, unknown>)) {
    if (typeof role === "string" && role in ROLE_RANK) {
      roles[teamId] = role as Role;
      found = true;
    }
  }
  return found ? roles : undefined;
}

/** Team grant for one team: the session `team_roles` map first when the
 *  backend carries it, else the membership row from `GET /auth/me/teams`.
 *  Pure — unit-testable without hooks.
 */
export function teamRoleFor(
  teams: readonly TeamWithRole[] | undefined,
  teamId: string | undefined,
  sessionRoles?: Record<string, Role> | undefined
): Role | undefined {
  if (!teamId) return undefined;
  const fromSession = sessionRoles?.[teamId];
  if (fromSession) return fromSession;
  return teams?.find((team) => team.team_id === teamId)?.role;
}

/** Team-scoped role for affordance gating (e.g. per-team grant buttons).
 *  Undefined while loading, logged out, or not a member of the team.
 *  Compare with `roleCan(teamRole, action)`; global `useCan` semantics
 *  are unchanged. The membership query stays disabled without a session,
 *  so logged-out users trigger no extra request.
 */
export function useTeamRole(teamId: string | undefined): Role | undefined {
  const { data: session } = useSession();
  const { data: teams } = useMyTeams(!!session);
  return teamRoleFor(teams, teamId, sessionTeamRoles(session));
}

/** Pure suspension decision (spec 0041 Slice B). Suspended means: we hold
 *  a last-known session, but session-scoped reads now fail with repeated
 *  401s. Without a last-known session the same 401s mean logged-out.
 *  Both 401s are required — one stray 401 is noise, not suspension.
 */
export function isSuspendedWorkspace(args: {
  hasLastKnownSession: boolean;
  sessionUnauthorized: boolean;
  teamsUnauthorized: boolean;
}): boolean {
  return args.hasLastKnownSession && args.sessionUnauthorized && args.teamsUnauthorized;
}

/** True when the workspace looks suspended: last-known session data is
 *  still cached but the session + teams reads both 401. Drives the
 *  `AppShell` banner; never redirects (the api-client login bounce stays
 *  the path for the genuinely logged-out case).
 */
export function useSuspendedWorkspace(): boolean {
  const sessionQuery = useSession();
  const teamsQuery = useMyTeams(!!sessionQuery.data);
  return isSuspendedWorkspace({
    hasLastKnownSession: !!sessionQuery.data,
    sessionUnauthorized: isUnauthorizedError(sessionQuery.error),
    teamsUnauthorized: isUnauthorizedError(teamsQuery.error),
  });
}
