"use client";

import { useSession } from "@/services/auth";
import type { Role } from "@/lib/schemas/auth";

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
