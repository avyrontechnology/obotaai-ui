import { z } from "zod";
import { roleSchema } from "./auth";

/** Zod mirror of voiceai/voiceai/modules/auth/models/{tenant,organization,team,membership}.py
 *  (spec 0040, Phase D). Keep in sync. BaseFields extras (id stamps, audit
 *  fields, tenant scoping) are stripped — never read client-side.
 */

export const tenantSchema = z.object({
  tenant_id: z.string().min(1),
  slug: z.string(),
  name: z.string(),
  plan: z.string().default("default"),
  status: z.enum(["active", "suspended"]).default("active"),
});
export type Tenant = z.infer<typeof tenantSchema>;

export const organizationSchema = z.object({
  org_id: z.string().min(1),
  tenant_id: z.string(),
  name: z.string(),
});
export type Organization = z.infer<typeof organizationSchema>;

export const teamSchema = z.object({
  team_id: z.string().min(1),
  org_id: z.string(),
  tenant_id: z.string(),
  name: z.string(),
});
export type Team = z.infer<typeof teamSchema>;

/** A team row as returned by GET /auth/me/teams: the row plus the caller's
 *  grant when the backend includes it (role stays optional — rows without
 *  one still parse, falling back to the global role for display). */
export const teamWithRoleSchema = teamSchema.extend({
  role: roleSchema.optional(),
});
export type TeamWithRole = z.infer<typeof teamWithRoleSchema>;

export const meTeamsSchema = z.array(teamWithRoleSchema);
export type MyTeams = z.infer<typeof meTeamsSchema>;

export const membershipSchema = z.object({
  membership_id: z.string().min(1),
  user_id: z.string().min(1),
  team_id: z.string().min(1),
  org_id: z.string(),
  tenant_id: z.string(),
  role: roleSchema,
});
export type Membership = z.infer<typeof membershipSchema>;

export const createTeamSchema = z.object({
  org_id: z.string().min(1),
  name: z.string().min(1),
});
export type CreateTeamInput = z.input<typeof createTeamSchema>;

export const addMembershipSchema = z.object({
  user_id: z.string().min(1),
  role: roleSchema.default("member"),
});
export type AddMembershipInput = z.input<typeof addMembershipSchema>;
