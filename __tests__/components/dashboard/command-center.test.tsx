import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RecentCalls } from "@/components/dashboard/recent-calls";
import { StatCards } from "@/components/dashboard/stat-cards";
import type { Execution } from "@/lib/schemas/platform";

jest.mock("@/services/api", () => ({
  useAgents: () => ({
    data: [{ agent_id: "agent-1", agent_name: "Support", agent_type: "voice", agent_config: {}, agent_prompts: {} }],
  }),
  useDeleteAgent: () => ({ mutate: jest.fn(), isPending: false }),
}));

jest.mock("@/components/calls/execution-drawer", () => ({
  ExecutionDrawer: () => null,
}));

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
    latency: { transcriber_ms: 100, llm_ms: 200, synthesizer_ms: 300, e2e_ms: 600 },
    hangup_code: null,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_s: 12,
    ...overrides,
  } as Execution;
}

const queryClient = new QueryClient();
function renderWithProviders(component: React.ReactNode) {
  return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
}

describe("command center", () => {
  it("renders range stats with sparkline and stage averages", () => {
    const rows = [execution(), execution({ execution_id: "exec-2", status: "failed" })];
    renderWithProviders(
      <StatCards current={rows} previous={[]} range="24h" rangeMs={24 * 60 * 60 * 1000} />
    );
    expect(screen.getByText("Total calls")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/STT 100ms/)).toBeInTheDocument();
    expect(screen.getByText("50.0%")).toBeInTheDocument();
    expect(screen.getByText("Active fleet")).toBeInTheDocument();
  });

  it("filters traces and opens the inspector", () => {
    const rows = [
      execution({ execution_id: "exec-1", to_number: "+91111" }),
      execution({ execution_id: "exec-2", to_number: "+91222", status: "failed" }),
    ];
    renderWithProviders(<RecentCalls executions={rows} />);
    expect(screen.getByText("+91111")).toBeInTheDocument();
    expect(screen.getByText("+91222")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Filter traces"), { target: { value: "+91111" } });
    expect(screen.getByText("+91111")).toBeInTheDocument();
    expect(screen.queryByText("+91222")).not.toBeInTheDocument();
    expect(screen.getByText(/1 shown/)).toBeInTheDocument();
  });

  it("renders nothing when the range is empty", () => {
    const { container } = renderWithProviders(<RecentCalls executions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
