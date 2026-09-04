import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  inboundConfigSchema,
  updateInboundSchema,
  type InboundConfig,
  type UpdateInboundInput,
} from "@/lib/schemas/platform";

export const inboundKeys = {
  all: ["inbound"] as const,
  detail: (agent_id: string) => ["inbound", agent_id] as const,
};

export function useInbound(agent_id: string, enabled = true) {
  return useQuery({
    queryKey: inboundKeys.detail(agent_id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/inbound/${agent_id}`);
      return inboundConfigSchema.parse(raw);
    },
    enabled: enabled && agent_id.length > 0,
  });
}

export function useUpdateInbound(agent_id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateInboundInput) => {
      const raw = await apiClient<unknown>(`/inbound/${agent_id}`, {
        method: "PUT",
        body: JSON.stringify(updateInboundSchema.parse(input)),
      });
      return inboundConfigSchema.parse(raw) as InboundConfig;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: inboundKeys.detail(agent_id) }),
  });
}
