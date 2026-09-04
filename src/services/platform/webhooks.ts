import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  createWebhookSchema,
  webhookListSchema,
  webhookSchema,
  type CreateWebhookInput,
  type Webhook,
} from "@/lib/schemas/platform";

export const webhookKeys = {
  all: ["webhooks"] as const,
};

export function useWebhooks() {
  return useQuery({
    queryKey: webhookKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/webhooks");
      return webhookListSchema.parse(raw).webhooks;
    },
  });
}

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateWebhookInput) => {
      const raw = await apiClient<unknown>("/webhooks", {
        method: "POST",
        body: JSON.stringify(createWebhookSchema.parse(input)),
      });
      return webhookSchema.parse(raw) as Webhook;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhookKeys.all }),
  });
}

export function useDeleteWebhook() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/webhooks/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: webhookKeys.all }),
  });
}
