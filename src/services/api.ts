import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { toCreateAgentPayload, toFrontendAgent } from "./api-transforms";
import type {
  AgentData,
  TranscriberConfig,
  SynthesizerConfig,
  LLMConfig,
  RagConfig,
  ConversationConfig,
  AgentConfigData,
} from "@/lib/schemas/agent";

export type { TranscriberConfig, SynthesizerConfig, LLMConfig, RagConfig, ConversationConfig };

export type AgentConfig = AgentConfigData;

export interface Agent {
  agent_id: string;
  agent_name: string;
  agent_type: string;
  agent_config: AgentConfig;
  agent_prompts: {
    system_prompt?: string;
    welcome_message?: string;
  };
}

// --- Query Keys ---
export const queryKeys = {
  agents: {
    all: ["agents"] as const,
    detail: (id: string) => ["agents", id] as const,
  },
};

export function useAgents() {
  return useQuery({
    queryKey: queryKeys.agents.all,
    queryFn: async () => {
      const response = await apiClient<{ agents: Record<string, unknown>[] }>("/all");
      const rawAgents = response.agents || [];
      // Defensive: old backends list namespaced platform records here.
      // Genuine agents always carry a tasks array.
      return rawAgents
        .filter((raw) => {
          const nested =
            (raw.data as Record<string, unknown> | undefined) ??
            (raw.agent_config as Record<string, unknown> | undefined);
          return Array.isArray(nested?.tasks) || Array.isArray(raw.tasks);
        })
        .map(toFrontendAgent);
    },
  });
}

export function useAgent(id: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.agents.detail(id),
    queryFn: async () => {
      const raw = await apiClient<Record<string, unknown>>(`/agent/${id}`);
      // GET /agent/:id returns the raw Redis record, which carries neither
      // agent_id nor agent_prompts (prompts live in a separate prompts file
      // with no read endpoint). Inject the id we requested.
      return toFrontendAgent({ ...raw, agent_id: (raw.agent_id as string) || id });
    },
    enabled: enabled && id.length > 0,
  });
}

export interface StoredPrompts {
  system_prompt?: string;
  welcome_message?: string;
  multilingual_prompts?: Record<string, { system_prompt: string; welcome_message?: string }>;
}

/**
 * Parse a stored prompts-file payload. The backend writes
 * `{ task_1: { system_prompt, ... } }`; older seeds wrote a flat
 * `{ system_prompt, welcome_message }`. Both are accepted.
 */
export function parseStoredPrompts(raw: unknown): StoredPrompts {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const record = raw as Record<string, unknown>;
  const task = record.task_1;
  const source =
    task && typeof task === "object" && !Array.isArray(task)
      ? (task as Record<string, unknown>)
      : record;
  const result: StoredPrompts = {};
  if (typeof source.system_prompt === "string") result.system_prompt = source.system_prompt;
  if (typeof source.welcome_message === "string") result.welcome_message = source.welcome_message;
  if (source.multilingual_prompts && typeof source.multilingual_prompts === "object") {
    result.multilingual_prompts = source.multilingual_prompts as StoredPrompts["multilingual_prompts"];
  }
  return result;
}

export function useAgentPrompts(id: string, enabled = true) {
  return useQuery({
    queryKey: [...queryKeys.agents.detail(id), "prompts"] as const,
    queryFn: async () => {
      const raw = await apiClient<{ agent_prompts?: unknown }>(`/agent/${id}/prompts`);
      return parseStoredPrompts(raw.agent_prompts);
    },
    enabled: enabled && id.length > 0,
  });
}

export function useCreateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AgentData) => {
      const payload = toCreateAgentPayload(data);
      const result = await apiClient<{ agent_id: string; state?: string }>("/agent", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // Return a minimal Agent shape for post-creation navigation
      return {
        agent_id: result.agent_id,
        agent_name: data.agent_name,
        agent_type: data.agent_type,
        agent_config: data.agent_config,
        agent_prompts: data.agent_prompts,
      } as Agent;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
    },
  });
}

export function useUpdateAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AgentData }) => {
      const payload = toCreateAgentPayload(data);
      return apiClient<Record<string, unknown>>(`/agent/${id}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(variables.id) });
    },
  });
}

export function useDeleteAgent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return apiClient<{ success: boolean }>(`/agent/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
    },
  });
}
