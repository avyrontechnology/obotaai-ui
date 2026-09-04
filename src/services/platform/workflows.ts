import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import {
  campaignListSchema,
  createCampaignSchema,
  validationResultSchema,
  workflowDefinitionSchema,
  workflowDocSchema,
  workflowListSchema,
  workflowRunListSchema,
  workflowRunSchema,
  workflowVersionListSchema,
  type CreateCampaignInput,
  type WorkflowCampaign,
  type WorkflowDefinition,
  type WorkflowDoc,
  type WorkflowRun,
} from "@/lib/schemas/builders";

export const workflowKeys = {
  all: ["workflows"] as const,
  detail: (id: string) => ["workflows", id] as const,
  versions: (id: string) => ["workflows", id, "versions"] as const,
};

export const campaignKeys = {
  all: ["workflow-campaigns"] as const,
  detail: (id: string) => ["workflow-campaigns", id] as const,
};

export function useWorkflows() {
  return useQuery({
    queryKey: workflowKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/workflows");
      return workflowListSchema.parse(raw).workflows;
    },
  });
}

export function useWorkflow(id: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.detail(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/workflows/${id}`);
      return workflowDocSchema.parse(raw);
    },
    enabled: enabled && id.length > 0,
  });
}

export function useCreateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; definition?: WorkflowDefinition }) => {
      const raw = await apiClient<unknown>("/workflows", {
        method: "POST",
        body: JSON.stringify({
          name: input.name,
          definition: workflowDefinitionSchema.parse(input.definition ?? {}),
        }),
      });
      return workflowDocSchema.parse(raw) as WorkflowDoc;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
  });
}

export function useUpdateWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name, definition }: { id: string; name?: string; definition?: WorkflowDefinition }) => {
      const raw = await apiClient<unknown>(`/workflows/${id}`, {
        method: "PUT",
        body: JSON.stringify({
          ...(name !== undefined ? { name } : {}),
          ...(definition !== undefined ? { definition: workflowDefinitionSchema.parse(definition) } : {}),
        }),
      });
      return workflowDocSchema.parse(raw) as WorkflowDoc;
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.all });
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(workflow.workflow_id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.versions(workflow.workflow_id) });
    },
  });
}

export function useDeleteWorkflow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await apiClient<unknown>(`/workflows/${id}`, { method: "DELETE" });
      return id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: workflowKeys.all }),
  });
}

export function useWorkflowVersions(id: string, enabled = true) {
  return useQuery({
    queryKey: workflowKeys.versions(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/workflows/${id}/versions`);
      return workflowVersionListSchema.parse(raw).versions;
    },
    enabled: enabled && id.length > 0,
  });
}

export function useRestoreWorkflowVersion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, version }: { id: string; version: number }) => {
      const raw = await apiClient<unknown>(`/workflows/${id}/restore/${version}`, { method: "POST" });
      return workflowDocSchema.parse(raw) as WorkflowDoc;
    },
    onSuccess: (workflow) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.detail(workflow.workflow_id) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.versions(workflow.workflow_id) });
    },
  });
}

export function useValidateWorkflow() {
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/workflows/${id}/validate`, { method: "POST" });
      return validationResultSchema.parse(raw);
    },
  });
}

export function useTestRunWorkflow() {
  return useMutation({
    mutationFn: async ({
      id,
      to_number,
      variables,
    }: {
      id: string;
      to_number?: string;
      variables?: Record<string, unknown>;
    }) => {
      const raw = await apiClient<unknown>(`/workflows/${id}/test-run`, {
        method: "POST",
        body: JSON.stringify({ to_number: to_number ?? "+910000000000", variables: variables ?? {}, delay_scale: 0 }),
      });
      return workflowRunSchema.parse(raw) as WorkflowRun;
    },
  });
}

export function useWorkflowRun(id: string, enabled = true) {
  return useQuery({
    queryKey: ["workflow-runs", id] as const,
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/workflow-runs/${id}`);
      return workflowRunSchema.parse(raw);
    },
    enabled: enabled && id.length > 0,
  });
}

export function useCampaigns() {
  return useQuery({
    queryKey: campaignKeys.all,
    queryFn: async () => {
      const raw = await apiClient<unknown>("/workflow-campaigns");
      return campaignListSchema.parse(raw).campaigns;
    },
  });
}

export function useCampaign(id: string, enabled = true) {
  return useQuery({
    queryKey: campaignKeys.detail(id),
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/workflow-campaigns/${id}`);
      return campaignListSchema.parse({ campaigns: [raw] }).campaigns[0];
    },
    enabled: enabled && id.length > 0,
  });
}

export function useCampaignRuns(id: string, enabled = true) {
  return useQuery({
    queryKey: [...campaignKeys.detail(id), "runs"] as const,
    queryFn: async () => {
      const raw = await apiClient<unknown>(`/workflow-campaigns/${id}/runs`);
      return workflowRunListSchema.parse(raw).runs;
    },
    enabled: enabled && id.length > 0,
  });
}

function invalidateCampaign(queryClient: ReturnType<typeof useQueryClient>, id?: string) {
  queryClient.invalidateQueries({ queryKey: campaignKeys.all });
  if (id) queryClient.invalidateQueries({ queryKey: campaignKeys.detail(id) });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCampaignInput) => {
      const raw = await apiClient<unknown>("/workflow-campaigns", {
        method: "POST",
        body: JSON.stringify(createCampaignSchema.parse(input)),
      });
      return campaignListSchema.parse({ campaigns: [raw] }).campaigns[0] as WorkflowCampaign;
    },
    onSuccess: () => invalidateCampaign(queryClient),
  });
}

export function useStartCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/workflow-campaigns/${id}/start`, { method: "POST" });
      return campaignListSchema.parse({ campaigns: [raw] }).campaigns[0] as WorkflowCampaign;
    },
    onSuccess: (campaign) => invalidateCampaign(queryClient, campaign.campaign_id),
  });
}

export function useStopCampaign() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const raw = await apiClient<unknown>(`/workflow-campaigns/${id}/stop`, { method: "POST" });
      return campaignListSchema.parse({ campaigns: [raw] }).campaigns[0] as WorkflowCampaign;
    },
    onSuccess: (campaign) => invalidateCampaign(queryClient, campaign.campaign_id),
  });
}
