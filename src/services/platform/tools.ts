import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAgent } from "@/services/api";
import {
  createToolSchema,
  toolListSchema,
  toolSchema,
  updateToolSchema,
  type AgentTool,
  type CreateToolInput,
  type UpdateToolInput,
} from "@/lib/schemas/platform";

/** Tool registry (spec 0029): system + tenant ToolDefinition rows.
 *
 *  Reads merge both views server-side (tenant wins ties); writes touch the
 *  tenant view only (system rows 403). Filter `deprecated` client-side for
 *  picker queries — grandfathered rows still resolve by id.
 */

export const toolKeys = {
  all: ["tools"] as const,
  filtered: (kind?: string) => ["tools", { kind: kind ?? null }] as const,
};

export function useTools(kind?: string, enabled = true) {
  return useQuery({
    queryKey: toolKeys.filtered(kind),
    queryFn: async () => {
      const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
      const raw = await apiClient<unknown>(`/tools${query}`);
      return toolListSchema.parse(raw).tools;
    },
    staleTime: 30 * 1000,
    retry: false,
    enabled,
  });
}

/** Live (non-deprecated) rows for pickers. */
export function usePickerTools(kind?: string, enabled = true) {
  const query = useTools(kind, enabled);
  return {
    ...query,
    data: query.data?.filter((tool) => !tool.deprecated),
  };
}

export function useCreateTenantTool() {
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

export function useUpdateTenantTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: UpdateToolInput }) => {
      const raw = await apiClient<unknown>(`/tools/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(updateToolSchema.parse(input)),
      });
      return toolSchema.parse(raw) as AgentTool;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolKeys.all }),
  });
}

export function useDeleteTenantTool() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/tools/${encodeURIComponent(id)}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: toolKeys.all }),
  });
}

export interface AttachedTool {
  /** Registry id for attached refs; null for legacy embedded entries. */
  ref: string | null;
  name: string;
  kind: string;
  description: string;
  deprecated: boolean;
  /** True when the ref resolves to no visible row (deleted/foreign). */
  missing: boolean;
  /** True for legacy embedded function defs (read-only, no registry row). */
  embedded: boolean;
}

function embeddedName(entry: unknown): string | null {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const record = entry as Record<string, unknown>;
  const fn = record.function;
  if (fn && typeof fn === "object" && !Array.isArray(fn)) {
    const name = (fn as Record<string, unknown>).name;
    if (typeof name === "string" && name.length > 0) return name;
  }
  if (typeof record.name === "string" && record.name.length > 0) return record.name;
  return null;
}

/** An agent's attached tools: registry refs resolved against the registry
 *  plus legacy embedded entries (read-only). Refs pointing at no visible
 *  row surface as missing instead of vanishing. */
export function useAttachedTools(agentId?: string, enabled = true) {
  const active = enabled && !!agentId;
  const agentQuery = useAgent(agentId ?? "", active);
  const apiTools = agentQuery.data?.agent_config?.api_tools;
  const refs = apiTools?.tool_refs ?? [];
  const registryQuery = useTools(undefined, active && agentQuery.isSuccess);
  const rows = new Map((registryQuery.data ?? []).map((row) => [row.tool_id, row]));

  let attached: AttachedTool[] | undefined;
  if (agentQuery.isSuccess && registryQuery.isSuccess) {
    attached = [
      ...refs.map((ref): AttachedTool => {
        const row = rows.get(ref);
        return row
          ? {
              ref,
              name: row.name,
              kind: row.kind,
              description: row.description,
              deprecated: row.deprecated,
              missing: false,
              embedded: false,
            }
          : { ref, name: ref, kind: "unknown", description: "", deprecated: false, missing: true, embedded: false };
      }),
      ...(apiTools?.embedded_tools ?? []).flatMap((entry): AttachedTool[] => {
        const name = embeddedName(entry);
        return name ? [{ ref: null, name, kind: "custom", description: "", deprecated: false, missing: false, embedded: true }] : [];
      }),
    ];
  }

  return {
    attached,
    refs,
    isLoading: agentQuery.isLoading || registryQuery.isLoading,
    isError: agentQuery.isError || registryQuery.isError,
  };
}
