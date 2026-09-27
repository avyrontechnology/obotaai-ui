import {
  dryRunResultSchema,
  graphDefinitionSchema,
  latencyStatsSchema,
  validationResultSchema,
  workflowDefinitionSchema,
  workflowRunSchema,
} from "@/lib/schemas/builders";
import { conversationSchema } from "@/lib/schemas/agent";
import type { PatchAgentInput, TaskPatchOperation } from "@/services/api";

const graphDefinition = {
  agent_information: "Route support calls.",
  start_node_id: "greet",
  routing_model: null,
  variables: {},
  nodes: [
    {
      id: "greet",
      node_type: "llm",
      description: null,
      prompt: "Greet.",
      static_message: null,
      repeat_after_silence_seconds: null,
      edges: [{ to_node_id: "bye", condition: "", label: null, condition_type: "unconditional" }],
    },
    { id: "bye", node_type: "static", static_message: "Bye!" },
  ],
};

describe("builder-schemas", () => {
  it("parses a graph definition with defaulted fields", () => {
    const parsed = graphDefinitionSchema.parse(graphDefinition);
    expect(parsed.nodes).toHaveLength(2);
    expect(parsed.nodes[1].edges).toEqual([]);
    expect(parsed.nodes[0].edges[0].condition_type).toBe("unconditional");
  });

  it("rejects unknown graph node types and empty ids", () => {
    expect(() =>
      graphDefinitionSchema.parse({ ...graphDefinition, nodes: [{ id: "", node_type: "llm" }] })
    ).toThrow();
    expect(() =>
      graphDefinitionSchema.parse({ ...graphDefinition, nodes: [{ id: "x", node_type: "teleport" }] })
    ).toThrow();
  });

  it("parses validation and dry-run results", () => {
    expect(
      validationResultSchema.parse({ valid: false, errors: ["no start"], warnings: [] }).valid
    ).toBe(false);
    const dry = dryRunResultSchema.parse({
      path: ["greet", "bye"],
      transcript_preview: [{ node: "bye", text: "Bye!" }],
      steps: 2,
      loop_detected: false,
    });
    expect(dry.path).toEqual(["greet", "bye"]);
  });

  it("parses workflow definitions, runs and latency stats", () => {
    const workflow = workflowDefinitionSchema.parse({
      nodes: [
        { id: "start", type: "start" },
        { id: "call", type: "agent", label: "Qualify", config: { agent_id: "a1" } },
        { id: "done", type: "end" },
      ],
      edges: [],
    });
    expect(workflow.nodes[1].config).toEqual({ agent_id: "a1" });
    expect(() =>
      workflowDefinitionSchema.parse({ nodes: [{ id: "x", type: "teleport" }], edges: [] })
    ).toThrow();

    const run = workflowRunSchema.parse({
      run_id: "run_1",
      workflow_id: "flow_1",
      campaign_id: null,
      contact: { to_number: "+911" },
      status: "completed",
      reports: [{ node_id: "call", type: "agent", status: "ok", detail: {}, at: "2026-09-03T00:00:00+00:00" }],
      started_at: null,
      ended_at: null,
    });
    expect(run.reports).toHaveLength(1);

    const latency = latencyStatsSchema.parse({
      count: 2,
      avg_e2e_ms: 300,
      p50_e2e_ms: 280,
      p95_e2e_ms: 320,
      by_stage: { transcriber_ms: 180 },
      buckets: [{ date: "2026-09-03", count: 2, avg_e2e_ms: 300 }],
    });
    expect(latency.p50_e2e_ms).toBeLessThanOrEqual(latency.p95_e2e_ms ?? 0);
  });

  // NOTE: this file previously never exercised conversationSchema — this
  // block is its first coverage, mirroring the backend ConversationConfig
  // (ambient_noise deleted; recording + 6 promoted keys added; online/
  // hangup messages accept string | dict).
  it("parses conversation promoted keys (string and dict message forms)", () => {
    const parsed = conversationSchema.parse({
      recording: false,
      call_hangup_message: "Thanks, bye!",
      check_user_online_message: "Are you still there?",
      welcome_message_delay: 1500,
      discard_pre_welcome_utterance: true,
      language_injection_mode: "dynamic",
      language_instruction_template: "Speak in {language}.",
      end_call_tool_mode: "strict",
    });
    expect(parsed.recording).toBe(false);
    expect(parsed.call_hangup_message).toBe("Thanks, bye!");
    expect(parsed.welcome_message_delay).toBe(1500);

    const dicts = conversationSchema.parse({
      call_hangup_message: { en: "Goodbye!", hi: "Alvida!" },
      check_user_online_message: { en: "Are you there?" },
    });
    expect(dicts.call_hangup_message).toEqual({ en: "Goodbye!", hi: "Alvida!" });

    // Open strings (backend injects nothing on unknown values) + zod strips
    // the deleted ambient_noise instead of failing legacy rows.
    expect(
      conversationSchema.safeParse({
        language_injection_mode: "legacy-custom",
        end_call_tool_mode: "legacy-custom",
      }).success
    ).toBe(true);
    const stripped = conversationSchema.parse({ ambient_noise: true });
    expect("ambient_noise" in stripped).toBe(false);
  });

  describe("spec 0043 extensions (schema)", () => {
    it("accepts an extensions record including dict values", () => {
      const parsed = conversationSchema.parse({
        extensions: {
          tenant_flag: "beta",
          max_retries: 3,
          ratio: 0.5,
          verbose: true,
          nested: { level: 2, tags: ["a", "b"] },
          labels: { en: "Hello!", hi: "Namaste!" },
        },
      });
      expect(parsed.extensions).toEqual({
        tenant_flag: "beta",
        max_retries: 3,
        ratio: 0.5,
        verbose: true,
        nested: { level: 2, tags: ["a", "b"] },
        labels: { en: "Hello!", hi: "Namaste!" },
      });
    });

    it("leaves extensions absent when unset and accepts an explicit {}", () => {
      expect("extensions" in conversationSchema.parse({})).toBe(false);
      expect(conversationSchema.parse({ extensions: {} }).extensions).toEqual({});
    });

    it("carries clear_extensions on the PATCH wire shape (TaskPatchOperation)", () => {
      // clear_extensions lives on the PATCH operation (src/services/api.ts),
      // not on the zod form schema: per-key drops inside
      // task_config.extensions, present-null a no-op (mirror of `clear`).
      const op: TaskPatchOperation = {
        task_index: 0,
        task_config: { extensions: { tenant_flag: "beta" } },
        clear_extensions: ["retired_flag"],
      };
      expect(op.clear_extensions).toEqual(["retired_flag"]);
      expect(op.task_config).toEqual({ extensions: { tenant_flag: "beta" } });
      const patch: PatchAgentInput = { tasks_patch: [op] };
      expect(patch.tasks_patch).toHaveLength(1);
    });

    it("strips ambient_noise instead of rejecting it (matches implementation)", () => {
      // NOTE(spec-0043): conversationSchema is a non-strict zod object, so the
      // 0042-deleted ambient_noise key is silently stripped — never a parse
      // failure — while sibling extensions survive.
      const result = conversationSchema.safeParse({
        ambient_noise: true,
        optimize_latency: true,
        extensions: { tenant_flag: "beta" },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect("ambient_noise" in result.data).toBe(false);
        expect(result.data.optimize_latency).toBe(true);
        expect(result.data.extensions).toEqual({ tenant_flag: "beta" });
      }
    });
  });
});
