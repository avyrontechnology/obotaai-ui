import {
  dryRunResultSchema,
  graphDefinitionSchema,
  latencyStatsSchema,
  validationResultSchema,
  workflowDefinitionSchema,
  workflowRunSchema,
} from "@/lib/schemas/builders";

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
});
