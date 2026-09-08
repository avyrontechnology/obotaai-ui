import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  executionListSchema,
  executionSchema,
  executionStatsSchema,
  simulateCallSchema,
  type Execution,
  type SimulateCallInput,
} from "@/lib/schemas/platform";
import { latencyStatsSchema } from "@/lib/schemas/builders";

export interface ExecutionFilters {
  agent_id?: string;
  batch_id?: string;
  status?: string;
  limit?: number;
  offset?: number;
}

export const executionKeys = {
  all: ["executions"] as const,
  filtered: (filters: ExecutionFilters) =>
    ["executions", filters] as const,
  detail: (id: string) => ["executions", id] as const,
  stats: (agent_id?: string) => ["executions", "stats", { agent_id }] as const,
};

async function fetchExecutions(filters: ExecutionFilters = {}) {
  const params = new URLSearchParams();
  if (filters.agent_id) params.set("agent_id", filters.agent_id);
  if (filters.batch_id) params.set("batch_id", filters.batch_id);
  if (filters.status) params.set("status", filters.status);
  if (filters.limit != null) params.set("limit", String(filters.limit));
  if (filters.offset != null) params.set("offset", String(filters.offset));
  const query = params.toString();
  const raw = await apiClient<unknown>(`/executions${query ? `?${query}` : ""}`);
  return executionListSchema.parse(raw).executions;
}

export function useExecutions(
  filters: ExecutionFilters = {},
  options?: { refetchInterval?: number | false; staleTime?: number }
) {
  return useQuery({
    queryKey: executionKeys.filtered(filters),
    queryFn: () => fetchExecutions(filters),
    placeholderData: (previousData) => previousData,
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
  });
}

export function useExecution(id: string, enabled = true) {
  return useQuery({
    queryKey: executionKeys.detail(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/executions/${id}`);
      return executionSchema.parse(raw);
    },
    enabled: enabled && id.length > 0,
  });
}

export function useExecutionStats(
  agent_id?: string,
  options?: { refetchInterval?: number | false; staleTime?: number }
) {
  return useQuery({
    queryKey: executionKeys.stats(agent_id),
    queryFn: async () => {
      const query = agent_id ? `?agent_id=${encodeURIComponent(agent_id)}` : "";
      const raw = await apiClient<unknown>(`/executions/stats${query}`);
      return executionStatsSchema.parse(raw);
    },
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
  });
}

export function useLatencyStats(
  agent_id?: string,
  days = 30,
  options?: { refetchInterval?: number | false; staleTime?: number }
) {
  return useQuery({
    queryKey: ["executions", "latency", { agent_id, days }] as const,
    queryFn: async () => {
      const params = new URLSearchParams({ days: String(days) });
      if (agent_id) params.set("agent_id", agent_id);
      const raw = await apiClient<unknown>(`/executions/latency/summary?${params.toString()}`);
      return latencyStatsSchema.parse(raw);
    },
    staleTime: options?.staleTime,
    refetchInterval: options?.refetchInterval,
  });
}

export function useSimulateCall() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: SimulateCallInput) => {
      const raw = await apiClient<unknown>("/calls/simulate", {
        method: "POST",
        body: JSON.stringify(simulateCallSchema.parse(input)),
      });
      return executionSchema.parse(raw) as Execution;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: executionKeys.all });
    },
  });
}
