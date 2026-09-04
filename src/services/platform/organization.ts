import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  organizationSchema,
  resetResponseSchema,
  updateOrganizationSchema,
  type Organization,
  type UpdateOrganizationInput,
} from "@/lib/schemas/platform";

export const organizationKeys = {
  all: ["organization"] as const,
};

export function useOrganization() {
  return useQuery({
    queryKey: organizationKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/organization");
      return organizationSchema.parse(raw);
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateOrganizationInput) => {
      const raw = await apiClient<unknown>("/organization", {
        method: "PUT",
        body: JSON.stringify(updateOrganizationSchema.parse(input)),
      });
      return organizationSchema.parse(raw) as Organization;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: organizationKeys.all }),
  });
}

export function useResetWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const raw = await apiClient<unknown>("/organization/reset", { method: "POST" });
      return resetResponseSchema.parse(raw);
    },
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
