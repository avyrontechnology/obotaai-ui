import {
  agentLabel,
  avgStageMs,
  binCounts,
  completionStats,
  filterByRange,
  p95E2E,
  splitWindows,
  trendPercent,
} from "@/lib/stats";
import type { Execution } from "@/lib/schemas/platform";

const NOW = new Date("2026-09-05T12:00:00Z").getTime();

function execution(overrides: Partial<Execution> = {}): Execution {
  return {
    execution_id: "exec-1",
    agent_id: "agent-1",
    batch_id: null,
    direction: "outbound",
    to_number: "+911234567890",
    from_number: null,
    status: "completed",
    variables: {},
    transcript: [],
    summary: null,
    extracted_data: {},
    latency: null,
    hangup_code: null,
    started_at: new Date(NOW - 10 * 60 * 1000).toISOString(),
    ended_at: null,
    duration_s: 12,
    ...overrides,
  } as Execution;
}

describe("dashboard stats", () => {
  it("filters executions to the trailing window", () => {
    const rows = [
      execution({ execution_id: "new" }),
      execution({
        execution_id: "old",
        started_at: new Date(NOW - 5 * 60 * 60 * 1000).toISOString(),
      }),
      execution({
        execution_id: "future",
        started_at: new Date(NOW + 60 * 1000).toISOString(),
      }),
    ];
    const filtered = filterByRange(rows, 60 * 60 * 1000, NOW);
    expect(filtered.map((e) => e.execution_id)).toEqual(["new"]);
  });

  it("splits current vs previous windows for trends", () => {
    const hour = 60 * 60 * 1000;
    const rows = [
      execution({ execution_id: "c1" }),
      execution({ execution_id: "c2" }),
      execution({ execution_id: "p1", started_at: new Date(NOW - 1.5 * hour).toISOString() }),
    ];
    const { current, previous } = splitWindows(rows, hour, NOW);
    expect(current.map((e) => e.execution_id).sort()).toEqual(["c1", "c2"]);
    expect(previous.map((e) => e.execution_id)).toEqual(["p1"]);
    expect(trendPercent(2, 1)).toBeCloseTo(100);
    expect(trendPercent(2, 0)).toBeNull();
    expect(trendPercent(1, 2)).toBeCloseTo(-50);
  });

  it("bins counts oldest to newest", () => {
    const hour = 60 * 60 * 1000;
    const rows = [
      execution({ execution_id: "a", started_at: new Date(NOW - 50 * 60 * 1000).toISOString() }),
      execution({ execution_id: "b", started_at: new Date(NOW - 5 * 60 * 1000).toISOString() }),
      execution({ execution_id: "c", started_at: new Date(NOW - 1 * 60 * 1000).toISOString() }),
    ];
    const bins = binCounts(rows, hour, 4, NOW);
    expect(bins).toHaveLength(4);
    expect(bins.map((b) => b.count)).toEqual([1, 0, 0, 2]);
    expect(bins[0].start).toBeLessThan(bins[3].start);
  });

  it("averages stage latencies skipping missing breakdowns", () => {
    const rows = [
      execution({ latency: { transcriber_ms: 100, llm_ms: 200, synthesizer_ms: 300, e2e_ms: 600 } }),
      execution({ latency: { transcriber_ms: 300, llm_ms: 200, synthesizer_ms: 500, e2e_ms: 1000 } }),
      execution({ latency: null }),
    ];
    expect(avgStageMs(rows)).toEqual({ stt: 200, tts: 400 });
    expect(avgStageMs([])).toEqual({ stt: null, tts: null });
  });

  it("computes completion and failed rates", () => {
    const rows = [
      execution({ status: "completed" }),
      execution({ status: "completed" }),
      execution({ status: "failed" }),
      execution({ status: "ringing" }),
    ];
    expect(completionStats(rows)).toEqual({ total: 4, completed: 2, completedRate: 0.5, failedRate: 0.25 });
    expect(completionStats([]).completedRate).toBeNull();
  });

  it("computes p95 of e2e samples", () => {
    const rows = [100, 200, 300, 400, 500].map((ms, i) =>
      execution({
        execution_id: `e${i}`,
        latency: { transcriber_ms: 0, llm_ms: 0, synthesizer_ms: 0, e2e_ms: ms },
      })
    );
    expect(p95E2E(rows)).toBe(500);
    expect(p95E2E([])).toBeNull();
    expect(p95E2E([execution()])).toBeNull();
  });

  it("labels agents with short id plus name", () => {
    expect(agentLabel("agent-123456789", "Support")).toBe("agent-12 (Support)");
    expect(agentLabel("short")).toBe("short");
  });
});
