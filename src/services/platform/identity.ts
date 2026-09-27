import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  createOrganizationSchema,
  createTenantSchema,
  membershipSchema,
  meTeamsSchema,
  organizationSchema,
  teamSchema,
  tenantSchema,
  createTeamSchema,
  addMembershipSchema,
  type AddMembershipInput,
  type CreateOrganizationInput,
  type CreateTeamInput,
  type CreateTenantInput,
  type Membership,
  type MyTeams,
  type Organization,
  type Team,
  type Tenant,
} from "@/lib/schemas/identity";
/** Team + membership management (specs 0040 + 0041, Phase D).
 *
 *  Follows the `voices.ts` react-query pattern. Reads are session-scoped
 *  (no extra scope in v1); mutations are admin-gated server-side with
 *  owner-only grants for owner/admin roles (mirroring the invite flow).
 */

export const identityKeys = {
  all: ["identity"] as const,
  myTeams: ["identity", "my-teams"] as const,
};

export function useMyTeams(enabled = true) {
  return useQuery({
    queryKey: identityKeys.myTeams,
    queryFn: async (): Promise<MyTeams> => {
      const raw = await apiClient<unknown>("/auth/me/teams");
      return meTeamsSchema.parse(raw);
    },
    staleTime: 60 * 1000,
    retry: false,
    enabled,
  });
}

export function useCreateTeam() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTeamInput): Promise<Team> => {
      const raw = await apiClient<unknown>("/auth/teams", {
        method: "POST",
        body: JSON.stringify(createTeamSchema.parse(input)),
      });
      return teamSchema.parse(raw) as Team;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useAddTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      teamId,
      input,
    }: {
      teamId: string;
      input: AddMembershipInput;
    }): Promise<Membership> => {
      const raw = await apiClient<unknown>(`/auth/teams/${encodeURIComponent(teamId)}/members`, {
        method: "POST",
        body: JSON.stringify(addMembershipSchema.parse(input)),
      });
      return membershipSchema.parse(raw) as Membership;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

export function useRemoveTeamMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, userId }: { teamId: string; userId: string }): Promise<string> => {
      await apiClient<unknown>(
        `/auth/teams/${encodeURIComponent(teamId)}/members/${encodeURIComponent(userId)}`,
        { method: "DELETE" }
      );
      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

/** Create a tenant (spec 0041 Slice A, owner-only server-side).
 *  Slugs are unique — a taken slug surfaces as 409. */
export function useCreateTenant() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateTenantInput): Promise<Tenant> => {
      const raw = await apiClient<unknown>("/auth/tenants", {
        method: "POST",
        body: JSON.stringify(createTenantSchema.parse(input)),
      });
      return tenantSchema.parse(raw) as Tenant;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}

/** Create an organization under a tenant (spec 0041 Slice A, owner-only
 *  server-side). The tenant_id rides the caller's session — callers fill
 *  it from `session.user.tenant_id`, never from a picker. Unknown
 *  tenants surface as 404. */
export function useCreateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrganizationInput): Promise<Organization> => {
      const raw = await apiClient<unknown>("/auth/organizations", {
        method: "POST",
        body: JSON.stringify(createOrganizationSchema.parse(input)),
      });
      return organizationSchema.parse(raw) as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: identityKeys.all });
    },
  });
}
