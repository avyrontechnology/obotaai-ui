import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  addMemberSchema,
  createSubAccountSchema,
  subAccountListSchema,
  subAccountSchema,
  type AddMemberInput,
  type CreateSubAccountInput,
  type SubAccount,
} from "@/lib/schemas/platform";

export const subAccountKeys = {
  all: ["sub-accounts"] as const,
  detail: (id: string) => ["sub-accounts", id] as const,
};

export function useSubAccounts() {
  return useQuery({
    queryKey: subAccountKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/sub-accounts");
      return subAccountListSchema.parse(raw).sub_accounts;
    },
  });
}

export function useCreateSubAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateSubAccountInput) => {
      const raw = await apiClient<unknown>("/sub-accounts", {
        method: "POST",
        body: JSON.stringify(createSubAccountSchema.parse(input)),
      });
      return subAccountSchema.parse(raw) as SubAccount;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subAccountKeys.all }),
  });
}

export function useDeleteSubAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/sub-accounts/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subAccountKeys.all }),
  });
}

export function useAddMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: AddMemberInput & { id: string }) => {
      const raw = await apiClient<unknown>(`/sub-accounts/${id}/members`, {
        method: "POST",
        body: JSON.stringify(addMemberSchema.parse(input)),
      });
      return subAccountSchema.parse(raw) as SubAccount;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subAccountKeys.all }),
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, email }: { id: string; email: string }) => {
      const raw = await apiClient<unknown>(
        `/sub-accounts/${id}/members?email=${encodeURIComponent(email)}`,
        { method: "DELETE" }
      );
      return subAccountSchema.parse(raw) as SubAccount;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: subAccountKeys.all }),
  });
}
