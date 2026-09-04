import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  createKBSchema,
  kbListSchema,
  knowledgeBaseSchema,
  updateVectorConfigSchema,
  vectorStoreConfigSchema,
  type CreateKBInput,
  type KnowledgeBase,
  type UpdateVectorConfigInput,
  type VectorStoreConfig,
} from "@/lib/schemas/platform";

export const kbKeys = {
  all: ["knowledgebases"] as const,
  vectorConfig: (agent_id: string) => ["knowledgebases", "vector-config", agent_id] as const,
};

export function useKnowledgeBases() {
  return useQuery({
    queryKey: kbKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/knowledgebases");
      return kbListSchema.parse(raw).knowledgebases;
    },
  });
}

export function useCreateKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateKBInput) => {
      const raw = await apiClient<unknown>("/knowledgebases", {
        method: "POST",
        body: JSON.stringify(createKBSchema.parse(input)),
      });
      return knowledgeBaseSchema.parse(raw) as KnowledgeBase;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbKeys.all }),
  });
}

export function useAttachKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agent_id }: { id: string; agent_id: string }) => {
      const raw = await apiClient<unknown>(`/knowledgebases/${id}/attach`, {
        method: "POST",
        body: JSON.stringify({ agent_id }),
      });
      return knowledgeBaseSchema.parse(raw) as KnowledgeBase;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbKeys.all }),
  });
}

export function useDeleteKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/knowledgebases/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbKeys.all }),
  });
}

export function useDetachKnowledgeBase() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agent_id }: { id: string; agent_id: string }) => {
      const raw = await apiClient<unknown>(`/knowledgebases/${id}/detach`, {
        method: "POST",
        body: JSON.stringify({ agent_id }),
      });
      return knowledgeBaseSchema.parse(raw) as KnowledgeBase;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbKeys.all }),
  });
}

export function useVectorConfig(agent_id: string, enabled = true) {
  return useQuery({
    queryKey: kbKeys.vectorConfig(agent_id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/agents/${agent_id}/vector-config`);
      return vectorStoreConfigSchema.parse(raw);
    },
    enabled: enabled && agent_id.length > 0,
  });
}

export function useUpdateVectorConfig(agent_id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateVectorConfigInput) => {
      const raw = await apiClient<unknown>(`/agents/${agent_id}/vector-config`, {
        method: "PUT",
        body: JSON.stringify(updateVectorConfigSchema.parse(input)),
      });
      return vectorStoreConfigSchema.parse(raw) as VectorStoreConfig;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: kbKeys.vectorConfig(agent_id) }),
  });
}
