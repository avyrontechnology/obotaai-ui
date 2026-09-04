import { z } from "zod";

/** Zod mirror of voiceai/platform/graphs.py + workflows.py + latency models. */

export const graphNodeTypeSchema = z.enum(["llm", "static", "router"]);
export const graphEdgeConditionSchema = z.enum(["llm", "expression", "unconditional", "event"]);

export const graphEdgeSchema = z.object({
  to_node_id: z.string().min(1),
  condition: z.string().default(""),
  label: z.string().nullable().optional(),
  condition_type: graphEdgeConditionSchema.default("llm"),
  expression: z.record(z.string(), z.unknown()).nullable().optional(),
  event_name: z.string().nullable().optional(),
  priority: z.number().nullable().optional(),
});

export const graphNodeSchema = z.object({
  id: z.string().min(1),
  node_type: graphNodeTypeSchema.default("llm"),
  description: z.string().nullable().optional(),
  prompt: z.string().default(""),
  static_message: z.string().nullable().optional(),
  repeat_after_silence_seconds: z.number().nullable().optional(),
  edges: z.array(graphEdgeSchema).default([]),
});

export const graphDefinitionSchema = z.object({
  agent_information: z.string().default(""),
  start_node_id: z.string().default(""),
  routing_model: z.string().nullable().optional(),
  variables: z.record(z.string(), z.string()).default({}),
  nodes: z.array(graphNodeSchema).default([]),
});

export const graphDocSchema = z.object({
  graph_id: z.string(),
  name: z.string(),
  agent_id: z.string().nullable().optional(),
  definition: graphDefinitionSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const graphListSchema = z.object({ graphs: z.array(graphDocSchema) });

export const graphVersionSchema = z.object({
  version_id: z.string(),
  graph_id: z.string(),
  version_number: z.number(),
  name: z.string(),
  definition: graphDefinitionSchema,
  note: z.string().nullable().optional(),
  created_at: z.string(),
});

export const graphVersionListSchema = z.object({ versions: z.array(graphVersionSchema) });

export const validationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
});

export const dryRunResultSchema = z.object({
  path: z.array(z.string()),
  transcript_preview: z.array(z.object({ node: z.string(), text: z.string() })),
  steps: z.number(),
  loop_detected: z.boolean(),
});

export const workflowNodeTypeSchema = z.enum([
  "start",
  "agent",
  "extraction",
  "api",
  "wait",
  "retry",
  "whatsapp",
  "end",
]);

export const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: workflowNodeTypeSchema.default("start"),
  label: z.string().default(""),
  config: z.record(z.string(), z.unknown()).default({}),
});

export const workflowEdgeSchema = z.object({
  from_node: z.string().min(1),
  to_node: z.string().min(1),
  label: z.string().default(""),
});

export const workflowDefinitionSchema = z.object({
  nodes: z.array(workflowNodeSchema).default([]),
  edges: z.array(workflowEdgeSchema).default([]),
});

export const workflowDocSchema = z.object({
  workflow_id: z.string(),
  name: z.string(),
  definition: workflowDefinitionSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

export const workflowListSchema = z.object({ workflows: z.array(workflowDocSchema) });

export const workflowVersionSchema = z.object({
  version_id: z.string(),
  workflow_id: z.string(),
  version_number: z.number(),
  name: z.string(),
  definition: workflowDefinitionSchema,
  note: z.string().nullable().optional(),
  created_at: z.string(),
});

export const workflowVersionListSchema = z.object({ versions: z.array(workflowVersionSchema) });

export const nodeReportSchema = z.object({
  node_id: z.string(),
  type: z.string(),
  status: z.enum(["ok", "failed", "skipped"]),
  detail: z.record(z.string(), z.unknown()).default({}),
  at: z.string(),
});

export const workflowRunSchema = z.object({
  run_id: z.string(),
  workflow_id: z.string(),
  campaign_id: z.string().nullable().optional(),
  contact: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(["running", "completed", "failed"]),
  reports: z.array(nodeReportSchema).default([]),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
});

export const workflowRunListSchema = z.object({ runs: z.array(workflowRunSchema) });

export const campaignEntrySchema = z.object({
  to_number: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).default({}),
});

export const campaignStatsSchema = z.object({
  total: z.number(),
  queued: z.number(),
  completed: z.number(),
  failed: z.number(),
});

export const campaignStatusSchema = z.enum(["draft", "scheduled", "running", "completed", "stopped"]);

export const workflowCampaignSchema = z.object({
  campaign_id: z.string(),
  workflow_id: z.string(),
  name: z.string(),
  status: campaignStatusSchema,
  entries: z.array(campaignEntrySchema),
  stats: campaignStatsSchema,
  created_at: z.string(),
  started_at: z.string().nullable().optional(),
  ended_at: z.string().nullable().optional(),
});

export const campaignListSchema = z.object({ campaigns: z.array(workflowCampaignSchema) });

export const createCampaignSchema = z.object({
  workflow_id: z.string().min(1),
  name: z.string().min(1),
  entries: z.array(campaignEntrySchema).min(1).max(1000),
});

export const latencyBucketSchema = z.object({
  date: z.string(),
  count: z.number(),
  avg_e2e_ms: z.number().nullable(),
});

export const latencyStatsSchema = z.object({
  count: z.number(),
  avg_e2e_ms: z.number().nullable(),
  p50_e2e_ms: z.number().nullable(),
  p95_e2e_ms: z.number().nullable(),
  by_stage: z.record(z.string(), z.number()),
  buckets: z.array(latencyBucketSchema),
});

export type GraphDefinition = z.infer<typeof graphDefinitionSchema>;
export type GraphNode = z.infer<typeof graphNodeSchema>;
export type GraphEdge = z.infer<typeof graphEdgeSchema>;
export type GraphDoc = z.infer<typeof graphDocSchema>;
export type GraphVersion = z.infer<typeof graphVersionSchema>;
export type ValidationResult = z.infer<typeof validationResultSchema>;
export type DryRunResult = z.infer<typeof dryRunResultSchema>;
export type WorkflowDefinition = z.infer<typeof workflowDefinitionSchema>;
export type WorkflowNode = z.infer<typeof workflowNodeSchema>;
export type WorkflowEdge = z.infer<typeof workflowEdgeSchema>;
export type WorkflowDoc = z.infer<typeof workflowDocSchema>;
export type WorkflowVersion = z.infer<typeof workflowVersionSchema>;
export type WorkflowRun = z.infer<typeof workflowRunSchema>;
export type NodeReport = z.infer<typeof nodeReportSchema>;
export type WorkflowCampaign = z.infer<typeof workflowCampaignSchema>;
export type CampaignEntry = z.infer<typeof campaignEntrySchema>;
export type CreateCampaignInput = z.input<typeof createCampaignSchema>;
export type LatencyStats = z.infer<typeof latencyStatsSchema>;
