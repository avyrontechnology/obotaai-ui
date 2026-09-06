import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  apiKeyListSchema,
  createApiKeyInputSchema,
  createApiKeyResponseSchema,
  type CreateApiKeyInput,
  type CreateApiKeyResponse,
} from "@/lib/schemas/platform";

export const apiKeyKeys = {
  all: ["api-keys"] as const,
};

export function useApiKeys() {
  return useQuery({
    queryKey: apiKeyKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/api-keys");
      return apiKeyListSchema.parse(raw).api_keys;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateApiKeyInput) => {
      const raw = await apiClient<unknown>("/api-keys", {
        method: "POST",
        body: JSON.stringify(createApiKeyInputSchema.parse(input)),
      });
      return createApiKeyResponseSchema.parse(raw) as CreateApiKeyResponse;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/api-keys/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeyKeys.all }),
  });
}
