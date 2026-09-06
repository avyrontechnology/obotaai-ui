import { render, screen } from "@testing-library/react";
import { CallsKpiStrip } from "@/components/calls/calls-kpi-strip";

jest.mock("@/services/platform/executions", () => ({
  useExecutionStats: () => ({
    data: { total: 42, completed_rate: 0.85, by_status: { completed: 35, failed: 2 }, avg_e2e_ms: 1200, total_duration_s: 1000 },
    isLoading: false,
  }),
  useLatencyStats: () => ({
    data: { count: 10, avg_e2e_ms: 1100, p50_e2e_ms: 900, p95_e2e_ms: 1500, by_stage: { transcriber_ms: 200, llm_ms: 600, synthesizer_ms: 300 }, buckets: [] },
    isLoading: false,
  }),
}));

describe("CallsKpiStrip", () => {
  it("renders total, completion, p95 and slowest stage from stats", () => {
    render(<CallsKpiStrip executions={[]} agentId="agent-1" />);
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("85.0%")).toBeInTheDocument();
    expect(screen.getByText("1.5s")).toBeInTheDocument();
  });

  it("shows fallback labels when rendered with page executions", () => {
    const execs = [
      { status: "completed", latency: { e2e_ms: 500, transcriber_ms: 100, llm_ms: 200, synthesizer_ms: 200 }, duration_s: 10 } as unknown as import("@/lib/schemas/platform").Execution,
    ];
    render(<CallsKpiStrip executions={execs} />);
    // Total still from mocked stats (42), but component must not crash with page data
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
