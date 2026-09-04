import {
  addMemberSchema,
  apiKeySchema,
  batchSchema,
  createApiKeyResponseSchema,
  createBatchSchema,
  executionSchema,
  inboundConfigSchema,
  integrationSchema,
  knowledgeBaseSchema,
  organizationSchema,
  phoneNumberSchema,
  subAccountSchema,
  templateSummarySchema,
  toolSchema,
  topUpSchema,
  updateOrganizationSchema,
  vectorStoreConfigSchema,
  voiceEntrySchema,
  walletSchema,
  webhookSchema,
} from "@/lib/schemas/platform";

const executionPayload = {
  execution_id: "exec_abc123",
  agent_id: "agent-1",
  batch_id: null,
  direction: "outbound",
  to_number: "+911234567890",
  from_number: null,
  status: "completed",
  variables: { customer_name: "Asha" },
  transcript: [
    { role: "agent", text: "Namaste Asha!", ts: 0.5, latency_ms: 280 },
    { role: "user", text: "Yes?", ts: 3.0, latency_ms: null },
  ],
  summary: "Confirmed interest.",
  extracted_data: { interested: true },
  latency: { transcriber_ms: 180, llm_ms: 60, synthesizer_ms: 220, e2e_ms: 280 },
  hangup_code: "completed",
  started_at: "2026-09-03T00:00:00+00:00",
  ended_at: "2026-09-03T00:00:12+00:00",
  duration_s: 12,
};

describe("platform-schemas", () => {
  it("parses a backend execution payload", () => {
    const parsed = executionSchema.parse(executionPayload);
    expect(parsed.execution_id).toBe("exec_abc123");
    expect(parsed.transcript).toHaveLength(2);
    expect(parsed.latency?.e2e_ms).toBe(280);
  });

  it("rejects an execution with unknown status", () => {
    expect(() => executionSchema.parse({ ...executionPayload, status: "teleported" })).toThrow();
  });

  it("parses a batch with stats", () => {
    const parsed = batchSchema.parse({
      batch_id: "batch_1",
      agent_id: "agent-1",
      name: "COD confirmations",
      status: "completed",
      entries: [{ to_number: "+911", variables: {} }],
      stats: { total: 1, queued: 0, completed: 1, failed: 0 },
      schedule_at: null,
      created_at: "2026-09-03T00:00:00+00:00",
      started_at: "2026-09-03T00:00:01+00:00",
      ended_at: "2026-09-03T00:00:05+00:00",
    });
    expect(parsed.stats.completed).toBe(1);
  });

  it("rejects batch creation with empty entries", () => {
    expect(() =>
      createBatchSchema.parse({ agent_id: "agent-1", name: "empty", entries: [] })
    ).toThrow();
  });

  it("parses phone number, knowledge base, tool and webhook payloads", () => {
    expect(
      phoneNumberSchema.parse({
        number_id: "num_1",
        number: "+911234567890",
        provider: "simulated",
        country: "IN",
        assigned_agent_id: null,
        status: "active",
        created_at: "2026-09-03T00:00:00+00:00",
      }).provider
    ).toBe("simulated");

    expect(
      knowledgeBaseSchema.parse({
        kb_id: "kb_1",
        name: "Refunds",
        sources: [{ type: "url", ref: "https://example.com" }],
        status: "ready",
        agent_ids: ["agent-1"],
        created_at: "2026-09-03T00:00:00+00:00",
      }).agent_ids
    ).toEqual(["agent-1"]);

    expect(
      toolSchema.parse({
        tool_id: "tool_1",
        agent_id: "agent-1",
        name: "transfer_to_human",
        kind: "transfer",
        config: {},
        enabled: true,
        created_at: "2026-09-03T00:00:00+00:00",
      }).kind
    ).toBe("transfer");

    expect(
      webhookSchema.parse({
        webhook_id: "wh_1",
        agent_id: null,
        url: "https://example.com/hook",
        events: ["call.completed"],
        enabled: true,
        created_at: "2026-09-03T00:00:00+00:00",
      }).events
    ).toEqual(["call.completed"]);
  });

  it("rejects unknown tool kind and phone provider", () => {
    expect(() =>
      toolSchema.parse({
        tool_id: "t",
        name: "x",
        kind: "teleport",
        config: {},
        enabled: true,
        created_at: "2026-09-03T00:00:00+00:00",
      })
    ).toThrow();
    expect(() =>
      phoneNumberSchema.parse({
        number_id: "n",
        number: "+911",
        provider: "pigeon",
        country: "IN",
        status: "active",
        created_at: "2026-09-03T00:00:00+00:00",
      })
    ).toThrow();
  });

  it("parses wallet and ledger, rejects non-positive top-up", () => {
    expect(
      walletSchema.parse({
        balance_credits: 500,
        currency: "credits",
        updated_at: "2026-09-03T00:00:00+00:00",
      }).balance_credits
    ).toBe(500);
    expect(() => topUpSchema.parse({ amount_credits: 0 })).toThrow();
    expect(topUpSchema.parse({ amount_credits: 100 }).amount_credits).toBe(100);
  });

  it("parses template summaries", () => {
    const parsed = templateSummarySchema.parse({
      template_id: "tmpl-cod-confirmation",
      name: "COD Confirmation Agent",
      industry: "E-Commerce",
      description: "Confirms COD orders.",
      languages: ["en", "hi"],
    });
    expect(parsed.languages).toContain("hi");
  });

  it("parses inbound config and rejects unknown match source", () => {
    const parsed = inboundConfigSchema.parse({
      agent_id: "agent-1",
      assigned_number_id: null,
      greeting: null,
      spam_protection: true,
      caller_match_source: "csv",
      caller_match_ref: "customers.csv",
      blocklist: ["+91111"],
      updated_at: "2026-09-03T00:00:00+00:00",
    });
    expect(parsed.blocklist).toEqual(["+91111"]);
    expect(() =>
      inboundConfigSchema.parse({ ...parsed, caller_match_source: "telepathy" })
    ).toThrow();
  });

  it("parses voice entries and rejects unknown source", () => {
    const parsed = voiceEntrySchema.parse({
      voice_id: "voice_1",
      agent_id: "agent-1",
      name: "Asha (cloned)",
      provider: "elevenlabs",
      provider_voice_id: "abc123",
      source: "cloned",
      language: "hi",
      created_at: "2026-09-03T00:00:00+00:00",
    });
    expect(parsed.source).toBe("cloned");
    expect(() => voiceEntrySchema.parse({ ...parsed, source: "grown" })).toThrow();
  });

  it("parses vector-store config and rejects unknown provider", () => {
    const parsed = vectorStoreConfigSchema.parse({
      provider: "lancedb",
      connection_string: null,
      db_name: null,
      collection_name: null,
      index_name: null,
      embedding_model: null,
      embedding_dimensions: null,
      vector_id: "support-docs",
      similarity_top_k: 8,
      score_threshold: 0.1,
      reranker_enabled: true,
      reranker_model_type: "bge-large",
      candidate_count: 20,
      final_count: 5,
      updated_at: "2026-09-03T00:00:00+00:00",
    });
    expect(parsed.vector_id).toBe("support-docs");
    expect(() => vectorStoreConfigSchema.parse({ ...parsed, provider: "pinecone" })).toThrow();
  });

  it("parses sub-accounts with members and rejects bad email", () => {
    const parsed = subAccountSchema.parse({
      sub_id: "sub_1",
      name: "Acme EU",
      concurrency_cap: 25,
      members: [{ email: "ops@acme.io", name: "Ops", role: "admin", added_at: "2026-09-03T00:00:00+00:00" }],
      created_at: "2026-09-03T00:00:00+00:00",
    });
    expect(parsed.members).toHaveLength(1);
    expect(() =>
      addMemberSchema.parse({ email: "not-an-email", role: "admin" })
    ).toThrow();
    expect(addMemberSchema.parse({ email: "a@b.io", role: "viewer" }).role).toBe("viewer");
  });

  it("parses integrations with masked secrets and rejects unknown kind", () => {
    const parsed = integrationSchema.parse({
      integration_id: "int_1",
      kind: "twilio",
      name: "Primary",
      config: { account_sid: "AC123", auth_token: "••••••••" },
      enabled: true,
      created_at: "2026-09-03T00:00:00+00:00",
      updated_at: "2026-09-03T00:00:00+00:00",
    });
    expect(parsed.config.auth_token).toBe("••••••••");
    expect(() => integrationSchema.parse({ ...parsed, kind: "pigeon" })).toThrow();
  });

  it("parses organization and validates updates", () => {
    const parsed = organizationSchema.parse({
      org_id: "default",
      name: "Acme",
      support_email: "ops@acme.io",
      data_residency: "in",
      session_timeout_mins: 60,
      ip_allowlist: [],
      notifications: {
        low_balance_enabled: true,
        low_balance_threshold: 50,
        call_failed_enabled: true,
        batch_completed_enabled: true,
        channel_email: true,
        channel_webhook: false,
      },
      updated_at: "2026-09-03T00:00:00+00:00",
    });
    expect(parsed.notifications.low_balance_threshold).toBe(50);
    expect(() => updateOrganizationSchema.parse({ data_residency: "moon" })).toThrow();
    expect(() => updateOrganizationSchema.parse({ session_timeout_mins: 1 })).toThrow();
    expect(updateOrganizationSchema.parse({ name: "New" }).name).toBe("New");
  });

  it("parses api keys with show-once secret", () => {
    const created = createApiKeyResponseSchema.parse({
      key_id: "key_1",
      name: "Prod",
      prefix: "sk_live_ab12",
      key: "sk_live_ab12secret",
      created_at: "2026-09-03T00:00:00+00:00",
    });
    expect(created.key.startsWith("sk_live_")).toBe(true);
    const listed = apiKeySchema.parse({ ...created, last_used_at: null });
    expect("key" in listed).toBe(false);
  });
});
