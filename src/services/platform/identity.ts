import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  membershipSchema,
  meTeamsSchema,
  teamSchema,
  createTeamSchema,
  addMembershipSchema,
  type AddMembershipInput,
  type CreateTeamInput,
  type Membership,
  type MyTeams,
  type Team,
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
