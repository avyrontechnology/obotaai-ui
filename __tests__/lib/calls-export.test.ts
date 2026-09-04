import { executionsToCsv } from "@/lib/calls-export";
import type { Execution } from "@/lib/schemas/platform";

const execution: Execution = {
  execution_id: "exec_abc123",
  agent_id: "agent-1",
  batch_id: null,
  direction: "outbound",
  to_number: "+911234567890",
  from_number: null,
  status: "completed",
  variables: {},
  transcript: [{ role: "agent", text: 'Said "hello", then left', ts: 0.5, latency_ms: 280 }],
  summary: "Done",
  extracted_data: {},
  latency: { transcriber_ms: 180, llm_ms: 60, synthesizer_ms: 220, e2e_ms: 280 },
  hangup_code: "completed",
  started_at: "2026-09-03T00:00:00+00:00",
  ended_at: "2026-09-03T00:00:12+00:00",
  duration_s: 12,
};

describe("executionsToCsv", () => {
  it("emits a header plus one row per execution", () => {
    const csv = executionsToCsv([execution]);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("execution_id");
    expect(lines[1]).toContain("exec_abc123");
  });

  it("escapes quotes and commas in transcript text", () => {
    const csv = executionsToCsv([execution]);
    expect(csv).toContain('"agent: Said ""hello"", then left"');
  });

  it("returns header only for an empty list", () => {
    expect(executionsToCsv([]).split("\n")).toHaveLength(1);
  });
});
