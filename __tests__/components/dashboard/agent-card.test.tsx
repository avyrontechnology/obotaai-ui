import { render, screen } from "@testing-library/react";
import { AgentCard } from "@/components/dashboard/agent-card";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Mock the API hooks
jest.mock("@/services/api", () => ({
  useDeleteAgent: () => ({
    mutate: jest.fn(),
    isPending: false,
  }),
}));

jest.mock("@/lib/rbac", () => ({
  useCan: () => true,
  minRoleFor: () => "member",
}));

const queryClient = new QueryClient();

const mockAgent = {
  agent_id: "agent-123",
  agent_name: "Test Voice Agent",
  agent_type: "voice",
  agent_config: {},
  agent_prompts: {},
};

describe("AgentCard", () => {
  const renderWithProviders = (component: React.ReactNode) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it("renders agent name, type chip and actions", () => {
    renderWithProviders(<AgentCard agent={mockAgent} />);

    expect(screen.getByText("Test Voice Agent")).toBeInTheDocument();
    expect(screen.getByText("agent-12")).toBeInTheDocument(); // first 8 chars of id
    expect(screen.getByText("Voice")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Test Voice Agent" })).toHaveAttribute(
      "href",
      "/agents/agent-123"
    );
    expect(screen.getByRole("link", { name: "Configure Test Voice Agent" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Talk to Test Voice Agent" })).toBeInTheDocument();
  });

  it("renders real session counts instead of placeholders", () => {
    renderWithProviders(<AgentCard agent={mockAgent} sessions={12} />);

    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.queryByText("241")).not.toBeInTheDocument();
    expect(screen.queryByText(/99\.9/)).not.toBeInTheDocument();
  });

  it("shows the configured model", () => {
    renderWithProviders(
      <AgentCard
        agent={{ ...mockAgent, agent_config: { llm: { provider: "openai", model: "gpt-4o" } } }}
        sessions={3}
      />
    );

    expect(screen.getByText("gpt-4o")).toBeInTheDocument();
  });

  it("renders the telemetry strip from stats", () => {
    renderWithProviders(
      <AgentCard
        agent={mockAgent}
        stats={{ sessions: 8, avgLatencyMs: 1200, successRate: 0.75, lastCallAt: null }}
      />
    );

    expect(screen.getByText("8")).toBeInTheDocument();
    expect(screen.getByText("1.2s")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("never")).toBeInTheDocument();
  });
});
