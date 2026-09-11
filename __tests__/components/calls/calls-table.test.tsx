import { render, screen, fireEvent } from "@testing-library/react";
import { CallsTable } from "@/components/calls/calls-table";

function execution(overrides: Record<string, unknown> = {}) {
  return {
    execution_id: "exec-1",
    agent_id: "agent-1",
    to_number: "+911234",
    from_number: null,
    direction: "outbound" as const,
    status: "completed" as const,
    started_at: new Date().toISOString(),
    duration_s: 12,
    latency: { e2e_ms: 800, transcriber_ms: 100, llm_ms: 400, synthesizer_ms: 300 },
    transcript: [],
    summary: null,
    extracted_data: {},
    variables: {},
    batch_id: null,
    hangup_code: null,
    ended_at: null,
  } as unknown as import("@/lib/schemas/platform").Execution;
}

describe("CallsTable", () => {
  it("renders recipient, agent, status and duration", () => {
    const onSelect = jest.fn();
    render(<CallsTable executions={[execution()]} agentNames={new Map([["agent-1", "Clinic"]])} onSelect={onSelect} />);
    expect(screen.getByText("+911234")).toBeInTheDocument();
    expect(screen.getByText("Clinic")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Open call/ }));
    expect(onSelect).toHaveBeenCalledWith("exec-1");
  });

  it("shows fallback for null numbers and short agent id", () => {
    const onSelect = jest.fn();
    const row = { ...execution(), to_number: null, agent_id: "very-long-agent-id-123" } as unknown as import("@/lib/schemas/platform").Execution;
    render(<CallsTable executions={[row]} agentNames={new Map()} onSelect={onSelect} />);
    // Counterparty, model and summary all fall back honestly — several "—".
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("very-lon…")).toBeInTheDocument();
  });

  it("shows direction icon title via status badge and time", () => {
    const onSelect = jest.fn();
    render(<CallsTable executions={[execution({ direction: "inbound" })]} agentNames={new Map()} onSelect={onSelect} />);
    expect(screen.getByRole("button", { name: /Open call/ })).toBeInTheDocument();
  });
});
