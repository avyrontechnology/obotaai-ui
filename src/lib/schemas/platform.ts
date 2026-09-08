import { z } from "zod";

/** Zod mirror of voiceai/voiceai/platform/models.py. Keep in sync. */

export const executionStatusSchema = z.enum([
  "queued",
  "ringing",
  "in_progress",
  "completed",
  "failed",
  "no-answer",
  "busy",
  "canceled",
]);

export const batchStatusSchema = z.enum([
  "draft",
  "scheduled",
  "running",
  "paused",
  "completed",
  "stopped",
]);

export const phoneNumberProviderSchema = z.enum(["twilio", "plivo", "exotel", "vobiz", "talko", "simulated"]);

export const toolKindSchema = z.enum(["transfer", "calendar", "custom", "datetime"]);

export const transcriptTurnSchema = z.object({
  role: z.enum(["agent", "user"]),
  text: z.string(),
  ts: z.number(),
  latency_ms: z.number().nullable(),
});

export const latencyBreakdownSchema = z.object({
  transcriber_ms: z.number(),
  llm_ms: z.number(),
  synthesizer_ms: z.number(),
  e2e_ms: z.number(),
});

export const executionSchema = z.object({
  execution_id: z.string(),
  agent_id: z.string(),
  batch_id: z.string().nullable(),
  direction: z.enum(["outbound", "inbound"]),
  to_number: z.string().nullable(),
  from_number: z.string().nullable(),
  status: executionStatusSchema,
  variables: z.record(z.string(), z.unknown()),
  transcript: z.array(transcriptTurnSchema),
  summary: z.string().nullable(),
  extracted_data: z.record(z.string(), z.unknown()),
  latency: latencyBreakdownSchema.nullable(),
  hangup_code: z.string().nullable(),
  started_at: z.string(),
  ended_at: z.string().nullable(),
  duration_s: z.number(),
});

export const executionListSchema = z.object({ executions: z.array(executionSchema) });

export const executionStatsSchema = z.object({
  total: z.number(),
  by_status: z.record(z.string(), z.number()),
  avg_e2e_ms: z.number().nullable(),
  total_duration_s: z.number(),
  completed_rate: z.number(),
});

export const simulateCallSchema = z.object({
  agent_id: z.string().min(1),
  to_number: z.string().min(1),
  from_number: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).default({}),
  batch_id: z.string().optional(),
  delay_scale: z.number().min(0).default(0.5),
});

export const batchEntrySchema = z.object({
  to_number: z.string().min(1),
  variables: z.record(z.string(), z.unknown()).default({}),
});

export const batchStatsSchema = z.object({
  total: z.number(),
  queued: z.number(),
  completed: z.number(),
  failed: z.number(),
});

export const batchSchema = z.object({
  batch_id: z.string(),
  agent_id: z.string(),
  name: z.string(),
  status: batchStatusSchema,
  entries: z.array(batchEntrySchema),
  stats: batchStatsSchema,
  schedule_at: z.string().nullable(),
  calling_hours: z.object({ start: z.string(), end: z.string() }).nullable().optional(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  ended_at: z.string().nullable(),
});

export const batchListSchema = z.object({ batches: z.array(batchSchema) });

export const createBatchSchema = z.object({
  agent_id: z.string().min(1),
  name: z.string().min(1),
  entries: z.array(batchEntrySchema).min(1),
  schedule_at: z.string().optional(),
  calling_hours: z
    .object({ start: z.string().regex(/^\d{2}:\d{2}$/), end: z.string().regex(/^\d{2}:\d{2}$/) })
    .optional(),
  delay_scale: z.number().min(0).default(0.5),
  provider: z.enum(["simulated", "talko"]).default("simulated"),
  from_number: z.string().optional(),
  talko_api_key: z.string().optional(),
});

export const phoneNumberSchema = z.object({
  number_id: z.string(),
  number: z.string(),
  provider: phoneNumberProviderSchema,
  country: z.string(),
  assigned_agent_id: z.string().nullable().optional(),
  status: z.string(),
  created_at: z.string(),
});

export const phoneNumberListSchema = z.object({ numbers: z.array(phoneNumberSchema) });

export const kbSourceSchema = z.object({
  type: z.enum(["pdf", "url", "text"]),
  ref: z.string().min(1),
});

export const knowledgeBaseSchema = z.object({
  kb_id: z.string(),
  name: z.string(),
  sources: z.array(kbSourceSchema),
  status: z.string(),
  agent_ids: z.array(z.string()),
  created_at: z.string(),
});

export const kbListSchema = z.object({ knowledgebases: z.array(knowledgeBaseSchema) });

export const createKBSchema = z.object({
  name: z.string().min(1),
  sources: z.array(kbSourceSchema).default([]),
});

export const toolSchema = z.object({
  tool_id: z.string(),
  agent_id: z.string().nullable().optional(),
  name: z.string(),
  kind: toolKindSchema,
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
  created_at: z.string(),
});

export const toolListSchema = z.object({ tools: z.array(toolSchema) });

export const createToolSchema = z.object({
  agent_id: z.string().optional(),
  name: z.string().min(1),
  kind: toolKindSchema,
  config: z.record(z.string(), z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export const webhookSchema = z.object({
  webhook_id: z.string(),
  agent_id: z.string().nullable().optional(),
  url: z.string(),
  events: z.array(z.string()),
  enabled: z.boolean(),
  created_at: z.string(),
});

export const webhookListSchema = z.object({ webhooks: z.array(webhookSchema) });

export const createWebhookSchema = z.object({
  agent_id: z.string().optional(),
  url: z.string().min(1),
  events: z.array(z.string()).default([]),
  enabled: z.boolean().default(true),
});

export const walletSchema = z.object({
  balance_credits: z.number(),
  currency: z.string(),
  updated_at: z.string(),
});

export const topUpSchema = z.object({
  amount_credits: z.number().gt(0),
  reason: z.string().optional(),
});

export const ledgerEntrySchema = z.object({
  entry_id: z.string(),
  type: z.enum(["topup", "debit"]),
  amount_credits: z.number(),
  reason: z.string().nullable().optional(),
  created_at: z.string(),
});

export const ledgerListSchema = z.object({ entries: z.array(ledgerEntrySchema) });

export const templateSummarySchema = z.object({
  template_id: z.string(),
  name: z.string(),
  industry: z.string(),
  description: z.string(),
  languages: z.array(z.string()),
});

export const templateListSchema = z.object({ templates: z.array(templateSummarySchema) });

export const templateDetailSchema = templateSummarySchema.extend({
  agent_payload: z.record(z.string(), z.unknown()),
});

export const inboundConfigSchema = z.object({
  agent_id: z.string(),
  assigned_number_id: z.string().nullable().optional(),
  greeting: z.string().nullable().optional(),
  spam_protection: z.boolean(),
  caller_match_source: z.enum(["none", "csv", "sheets", "api"]),
  caller_match_ref: z.string().nullable().optional(),
  blocklist: z.array(z.string()),
  updated_at: z.string(),
});

export const updateInboundSchema = z.object({
  assigned_number_id: z.string().nullable().optional(),
  greeting: z.string().nullable().optional(),
  spam_protection: z.boolean().default(true),
  caller_match_source: z.enum(["none", "csv", "sheets", "api"]).default("none"),
  caller_match_ref: z.string().nullable().optional(),
  blocklist: z.array(z.string()).default([]),
});

export const voiceEntrySchema = z.object({
  voice_id: z.string(),
  agent_id: z.string().nullable().optional(),
  name: z.string(),
  provider: z.string(),
  provider_voice_id: z.string(),
  source: z.enum(["provider", "cloned", "imported"]),
  language: z.string().nullable().optional(),
  created_at: z.string(),
});

export const voiceListSchema = z.object({ voices: z.array(voiceEntrySchema) });
export const createVoiceSchema = z.object({
  agent_id: z.string().optional(),
  name: z.string().min(1),
  provider: z.string().min(1),
  provider_voice_id: z.string().min(1),
  source: z.enum(["provider", "cloned", "imported"]).default("provider"),
  language: z.string().optional(),
});

export const vectorStoreConfigSchema = z.object({
  provider: z.enum(["mongodb", "lancedb"]),
  connection_string: z.string().nullable().optional(),
  db_name: z.string().nullable().optional(),
  collection_name: z.string().nullable().optional(),
  index_name: z.string().nullable().optional(),
  embedding_model: z.string().nullable().optional(),
  embedding_dimensions: z.number().nullable().optional(),
  vector_id: z.string().nullable().optional(),
  similarity_top_k: z.number(),
  score_threshold: z.number(),
  reranker_enabled: z.boolean(),
  reranker_model_type: z.string(),
  candidate_count: z.number(),
  final_count: z.number(),
  updated_at: z.string(),
});

export const updateVectorConfigSchema = vectorStoreConfigSchema.omit({ updated_at: true });

export const memberSchema = z.object({
  email: z.string().email(),
  name: z.string().nullable().optional(),
  role: z.enum(["owner", "admin", "member", "viewer"]),
  added_at: z.string(),
});

export const subAccountSchema = z.object({
  sub_id: z.string(),
  name: z.string(),
  concurrency_cap: z.number().nullable().optional(),
  members: z.array(memberSchema),
  created_at: z.string(),
});

export const subAccountListSchema = z.object({ sub_accounts: z.array(subAccountSchema) });

export const createSubAccountSchema = z.object({
  name: z.string().min(1),
  concurrency_cap: z.number().int().min(0).optional(),
});

export const addMemberSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

export const integrationKindSchema = z.enum([
  "twilio",
  "plivo",
  "exotel",
  "vobiz",
  "talko",
  "calcom",
  "n8n",
  "zapier",
  "sheets",
  "sip",
  "truecaller",
]);

export const integrationSchema = z.object({
  integration_id: z.string(),
  kind: integrationKindSchema,
  name: z.string(),
  config: z.record(z.string(), z.unknown()),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const integrationListSchema = z.object({ integrations: z.array(integrationSchema) });

export const createIntegrationSchema = z.object({
  kind: integrationKindSchema,
  name: z.string().min(1),
  config: z.record(z.string(), z.unknown()).default({}),
  enabled: z.boolean().default(true),
});

export const updateIntegrationSchema = z.object({
  name: z.string().min(1).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  enabled: z.boolean().optional(),
});

export const notificationPrefsSchema = z.object({
  low_balance_enabled: z.boolean(),
  low_balance_threshold: z.number(),
  call_failed_enabled: z.boolean(),
  batch_completed_enabled: z.boolean(),
  channel_email: z.boolean(),
  channel_webhook: z.boolean(),
});

export const organizationSchema = z.object({
  org_id: z.string(),
  name: z.string(),
  support_email: z.string(),
  data_residency: z.enum(["in", "us", "eu"]),
  session_timeout_mins: z.number(),
  ip_allowlist: z.array(z.string()),
  notifications: notificationPrefsSchema,
  updated_at: z.string(),
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).optional(),
  support_email: z.string().email().optional(),
  data_residency: z.enum(["in", "us", "eu"]).optional(),
  session_timeout_mins: z.number().int().min(5).max(480).optional(),
  ip_allowlist: z.array(z.string()).optional(),
  notifications: notificationPrefsSchema.partial().optional(),
});

export const apiKeySchema = z.object({
  key_id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()).default([]),
  expires_at: z.string().nullable().optional(),
  created_by: z.string().nullable().optional(),
  created_at: z.string(),
  last_used_at: z.string().nullable().optional(),
});

export const createApiKeyInputSchema = z.object({
  name: z.string().min(1),
  scopes: z.array(z.string()).default([]),
  expires_in_days: z.number().int().positive().optional(),
});

export const apiKeyListSchema = z.object({ api_keys: z.array(apiKeySchema) });

export const createApiKeyResponseSchema = z.object({
  key_id: z.string(),
  name: z.string(),
  prefix: z.string(),
  key: z.string(),
  created_at: z.string(),
});

export const resetResponseSchema = z.object({
  state: z.string(),
  cleared: z.record(z.string(), z.number()),
});

export type Execution = z.infer<typeof executionSchema>;
export type ExecutionStats = z.infer<typeof executionStatsSchema>;
export type TranscriptTurn = z.infer<typeof transcriptTurnSchema>;
export type LatencyBreakdown = z.infer<typeof latencyBreakdownSchema>;
export type SimulateCallInput = z.input<typeof simulateCallSchema>;
export type Batch = z.infer<typeof batchSchema>;
export type BatchEntry = z.infer<typeof batchEntrySchema>;
export type CreateBatchInput = z.input<typeof createBatchSchema>;
export type PhoneNumber = z.infer<typeof phoneNumberSchema>;
export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type CreateKBInput = z.input<typeof createKBSchema>;
export type AgentTool = z.infer<typeof toolSchema>;
export type CreateToolInput = z.input<typeof createToolSchema>;
export type Webhook = z.infer<typeof webhookSchema>;
export type CreateWebhookInput = z.input<typeof createWebhookSchema>;
export type Wallet = z.infer<typeof walletSchema>;
export type TopUpInput = z.infer<typeof topUpSchema>;
export type LedgerEntry = z.infer<typeof ledgerEntrySchema>;
export type TemplateSummary = z.infer<typeof templateSummarySchema>;
export type TemplateDetail = z.infer<typeof templateDetailSchema>;
export type InboundConfig = z.infer<typeof inboundConfigSchema>;
export type UpdateInboundInput = z.input<typeof updateInboundSchema>;
export type VoiceEntry = z.infer<typeof voiceEntrySchema>;
export type CreateVoiceInput = z.input<typeof createVoiceSchema>;
export type VectorStoreConfig = z.infer<typeof vectorStoreConfigSchema>;
export type UpdateVectorConfigInput = z.input<typeof updateVectorConfigSchema>;
export type Member = z.infer<typeof memberSchema>;
export type SubAccount = z.infer<typeof subAccountSchema>;
export type CreateSubAccountInput = z.input<typeof createSubAccountSchema>;
export type AddMemberInput = z.input<typeof addMemberSchema>;
export type Integration = z.infer<typeof integrationSchema>;
export type IntegrationKind = z.infer<typeof integrationKindSchema>;
export type CreateIntegrationInput = z.input<typeof createIntegrationSchema>;
export type UpdateIntegrationInput = z.input<typeof updateIntegrationSchema>;
export type Organization = z.infer<typeof organizationSchema>;
export type UpdateOrganizationInput = z.input<typeof updateOrganizationSchema>;
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;
export type ApiKey = z.infer<typeof apiKeySchema>;
export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>;
export type CreateApiKeyResponse = z.infer<typeof createApiKeyResponseSchema>;

export const API_SCOPES = [
  "agents:read",
  "agents:write",
  "calls:read",
  "calls:write",
  "batches:read",
  "batches:write",
  "platform:read",
  "platform:write",
  "users:read",
  "users:write",
  "keys:read",
  "keys:write",
  "admin",
] as const;
