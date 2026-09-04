import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  dryRunResultSchema,
  graphDefinitionSchema,
  graphDocSchema,
  graphListSchema,
  graphVersionListSchema,
  validationResultSchema,
  type GraphDefinition,
  type GraphDoc,
} from "@/lib/schemas/builders";

export const graphKeys = {
  all: ["graphs"] as const,
  detail: (id: string) => ["graphs", id] as const,
  versions: (id: string) => ["graphs", id, "versions"] as const,
};

export function useGraphs() {
  return useQuery({
    queryKey: graphKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/graphs");
      return graphListSchema.parse(raw).graphs;
    },
  });
}

export function useGraph(id: string, enabled = true) {
  return useQuery({
    queryKey: graphKeys.detail(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/graphs/${id}`);
      return graphDocSchema.parse(raw);
    },
    enabled: enabled && id.length > 0,
  });
}

export function useCreateGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; definition?: GraphDefinition }) => {
      const raw = await apiClient<unknown>("/graphs", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          definition: graphDefinitionSchema.parse(input.definition ?? {}),
        }),
      });
      return graphDocSchema.parse(raw) as GraphDoc;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: graphKeys.all }),
  });
}

export function useUpdateGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, definition }: { id: string; name?: string; definition?: GraphDefinition }) => {
      const raw = await apiClient<unknown>(`/graphs/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(name !== undefined ? { name } : {}),
          ...(definition !== undefined ? { definition: graphDefinitionSchema.parse(definition) } : {}),
        }),
      });
      return graphDocSchema.parse(raw) as GraphDoc;
    },
    onSuccess: (graph) => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
      queryClient.invalidateQueries({ queryKey: graphKeys.detail(graph.graph_id) });
      queryClient.invalidateQueries({ queryKey: graphKeys.versions(graph.graph_id) });
    },
  });
}

export function useDeleteGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/graphs/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: graphKeys.all }),
  });
}

export function useGraphVersions(id: string, enabled = true) {
  return useQuery({
    queryKey: graphKeys.versions(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/graphs/${id}/versions`);
      return graphVersionListSchema.parse(raw).versions;
    },
    enabled: enabled && id.length > 0,
  });
}

export function useRestoreGraphVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const raw = await apiClient<unknown>(`/graphs/${id}/restore/${version}`, { method: "POST" });
      return graphDocSchema.parse(raw) as GraphDoc;
    },
    onSuccess: (graph) => {
      queryClient.invalidateQueries({ queryKey: graphKeys.detail(graph.graph_id) });
      queryClient.invalidateQueries({ queryKey: graphKeys.versions(graph.graph_id) });
    },
  });
}

export function useValidateGraph() {
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/graphs/${id}/validate`, { method: "POST" });
      return validationResultSchema.parse(raw);
    },
  });
}

export function useDryRunGraph() {
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/graphs/${id}/dry-run`, { method: "POST" });
      return dryRunResultSchema.parse(raw);
    },
  });
}

export function useDeployGraph() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agent_name }: { id: string; agent_name: string }) => {
      const deploy = (await apiClient<unknown>(`/graphs/${id}/deploy`, {
        method: "POST",
        body: JSON.stringify({ agent_name }),
      })) as { agent_config: Record<string, unknown>; agent_prompts: Record<string, unknown> };
      if (!deploy?.agent_config) throw new Error("Deploy returned an unexpected payload");
      const created = await apiClient<{ agent_id: string }>("/agent", {
        method: "POST",
        body: JSON.stringify(deploy),
      });
      return created.agent_id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: graphKeys.all });
      queryClient.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}
