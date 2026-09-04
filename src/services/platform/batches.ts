import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  batchListSchema,
  batchSchema,
  createBatchSchema,
  executionListSchema,
  type Batch,
  type CreateBatchInput,
} from "@/lib/schemas/platform";
import { executionKeys } from "./executions";

export const batchKeys = {
  all: ["batches"] as const,
  filtered: (agent_id?: string) => ["batches", { agent_id }] as const,
  detail: (id: string) => ["batches", id] as const,
};

export function useBatches(agent_id?: string) {
  return useQuery({
    queryKey: batchKeys.filtered(agent_id),
    queryFn: async () => {
      const query = agent_id ? `?agent_id=${encodeURIComponent(agent_id)}` : "";
      const raw = await apiClient<unknown>(`/batches${query}`);
      return batchListSchema.parse(raw).batches;
    },
  });
}

export function useBatch(id: string, enabled = true) {
  return useQuery({
    queryKey: batchKeys.detail(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/batches/${id}`);
      return batchSchema.parse(raw);
    },
    enabled: enabled && id.length > 0,
  });
}

export function useBatchExecutions(batch_id: string, enabled = true) {
  return useQuery({
    queryKey: [...batchKeys.detail(batch_id), "executions"] as const,
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/batches/${batch_id}/executions`);
      return executionListSchema.parse(raw).executions;
    },
    enabled: enabled && batch_id.length > 0,
  });
}

function invalidateBatch(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: batchKeys.all });
  if (id) queryClient.invalidateQueries({ queryKey: batchKeys.detail(id) });
  queryClient.invalidateQueries({ queryKey: executionKeys.all });
}

export function useCreateBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateBatchInput) => {
      const raw = await apiClient<unknown>("/batches", {
        method: "POST",
        body: JSON.stringify(createBatchSchema.parse(input)),
      });
      return batchSchema.parse(raw) as Batch;
    },
    onSuccess: () => invalidateBatch(queryClient),
  });
}

export function useStartBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/batches/${id}/start`, { method: "POST" });
      return batchSchema.parse(raw) as Batch;
    },
    onSuccess: (batch) => invalidateBatch(queryClient, batch.batch_id),
  });
}

export function useStopBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/batches/${id}/stop`, { method: "POST" });
      return batchSchema.parse(raw) as Batch;
    },
    onSuccess: (batch) => invalidateBatch(queryClient, batch.batch_id),
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/batches/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: (id) => invalidateBatch(queryClient, id),
  });
}

export function useRetryFailed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/batches/${id}/retry-failed`, { method: "POST" });
      return batchSchema.parse(raw) as Batch;
    },
    onSuccess: () => invalidateBatch(queryClient),
  });
}
