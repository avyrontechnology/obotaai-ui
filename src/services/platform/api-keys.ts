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
    // gcTime 0: the response carries the plaintext `key`, shown once at
    // creation and never refetchable. Without this it would sit in the
    // mutation cache for the default 5 minutes after the form unmounts.
    gcTime: 0,
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
