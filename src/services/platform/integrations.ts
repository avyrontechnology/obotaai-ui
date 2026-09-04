import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  createIntegrationSchema,
  integrationListSchema,
  integrationSchema,
  updateIntegrationSchema,
  type CreateIntegrationInput,
  type Integration,
  type UpdateIntegrationInput,
} from "@/lib/schemas/platform";

export const integrationKeys = {
  all: ["integrations"] as const,
};

export function useIntegrations() {
  return useQuery({
    queryKey: integrationKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/integrations");
      return integrationListSchema.parse(raw).integrations;
    },
  });
}

export function useCreateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateIntegrationInput) => {
      const raw = await apiClient<unknown>("/integrations", {
        method: "POST",
        body: JSON.stringify(createIntegrationSchema.parse(input)),
      });
      return integrationSchema.parse(raw) as Integration;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: integrationKeys.all }),
  });
}

export function useUpdateIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateIntegrationInput & { id: string }) => {
      const raw = await apiClient<unknown>(`/integrations/${id}`, {
        method: "PUT",
        body: JSON.stringify(updateIntegrationSchema.parse(input)),
      });
      return integrationSchema.parse(raw) as Integration;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: integrationKeys.all }),
  });
}

export function useDeleteIntegration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/integrations/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: integrationKeys.all }),
  });
}
