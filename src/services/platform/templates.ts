import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  templateDetailSchema,
  templateListSchema,
  type TemplateDetail,
} from "@/lib/schemas/platform";

export const templateKeys = {
  all: ["templates"] as const,
  detail: (id: string) => ["templates", id] as const,
};

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/templates");
      return templateListSchema.parse(raw).templates;
    },
  });
}

export function useTemplate(id: string, enabled = true) {
  return useQuery({
    queryKey: templateKeys.detail(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/templates/${id}`);
      return templateDetailSchema.parse(raw) as unknown as TemplateDetail;
    },
    enabled: enabled && id.length > 0,
  });
}

export function useImportTemplate() {
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/templates/${id}/import`, { method: "POST" });
      const parsed = raw as { agent_payload: Record<string, unknown> };
      if (!parsed || typeof parsed.agent_payload !== "object") {
        throw new Error("Template import returned an unexpected payload");
      }
      return parsed.agent_payload;
    },
  });
}
