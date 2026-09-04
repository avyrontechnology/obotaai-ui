import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  createToolSchema,
  toolListSchema,
  toolSchema,
  type AgentTool,
  type CreateToolInput,
} from "@/lib/schemas/platform";

export const toolKeys = {
  all: ["agent-tools"] as const,
  filtered: (agent_id?: string) => ["agent-tools", { agent_id }] as const,
};

export function useAgentTools(agent_id?: string) {
  return useQuery({
    queryKey: toolKeys.filtered(agent_id),
    queryFn: async () => {
      const query = agent_id ? `?agent_id=${encodeURIComponent(agent_id)}` : "";
      const raw = await apiClient<unknown>(`/tools${query}`);
      return toolListSchema.parse(raw).tools;
    },
  });
}

export function useCreateAgentTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateToolInput) => {
      const raw = await apiClient<unknown>("/tools", {
        method: "POST",
        body: JSON.stringify(createToolSchema.parse(input)),
      });
      return toolSchema.parse(raw) as AgentTool;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolKeys.all }),
  });
}

export function useDeleteAgentTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/tools/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolKeys.all }),
  });
}
