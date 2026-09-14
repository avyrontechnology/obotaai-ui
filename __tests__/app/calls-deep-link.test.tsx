import { render, screen, fireEvent, act } from "@testing-library/react";
import CallsPage from "@/app/calls/page";

let mockParams = new URLSearchParams("");
const replaceMock = jest.fn();

jest.mock("@/services/platform/executions", () => ({
  useExecutions: jest.fn(),
  useLatencyStats: () => ({ data: null, isLoading: false, refetch: jest.fn() }),
  useExecution: jest.fn(() => ({ data: null, isLoading: false })),
  useExecutionStats: () => ({ data: null, isLoading: false, refetch: jest.fn() }),
}));
jest.mock("@/services/api", () => ({
  useAgents: () => ({
    data: [
      { agent_id: "agent-1", agent_name: "Clinic" },
      { agent_id: "agent-2", agent_name: "Sales" },
    ],
  }),
}));
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockParams,
  useRouter: () => ({ replace: replaceMock, push: jest.fn() }),
  usePathname: () => "/calls",
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useExecutions } = require("@/services/platform/executions") as {
  useExecutions: jest.Mock;
};

function execution(id: string, overrides: Record<string, unknown> = {}) {
  return {
    execution_id: id,
    agent_id: "agent-1",
    to_number: "+9112345",
    from_number: null,
    direction: "outbound",
    status: "completed",
    duration_s: 10,
    latency: null,
    started_at: new Date().toISOString(),
    transcript: [],
    ...overrides,
  };
}

describe("calls deep-link sync (override ?? param ?? default)", () => {
  beforeEach(() => {
    useExecutions.mockReset();
    useExecutions.mockReturnValue({ data: [], isLoading: false, error: null, refetch: jest.fn(), isFetching: false });
    mockParams = new URLSearchParams("");
    replaceMock.mockReset();
  });

  it("back/forward ?agent= change drops the manual override", async () => {
    mockParams = new URLSearchParams("agent=agent-1");
    const { rerender } = render(<CallsPage />);
    await act(async () => {});
    // Pills show the deep-linked agent.
    expect(screen.getByRole("button", { name: "Remove agent filter" })).toBeInTheDocument();

    // Simulate back navigation to a different agent — override must drop.
    mockParams = new URLSearchParams("agent=agent-2");
    rerender(<CallsPage />);
    await act(async () => {});
    expect(useExecutions).toHaveBeenLastCalledWith(
      expect.objectContaining({ agent_id: "agent-2" }),
      expect.anything()
    );
  });

  it("back/forward ?status= change drops the manual override", async () => {
    mockParams = new URLSearchParams("status=failed");
    const { rerender } = render(<CallsPage />);
    await act(async () => {});
    expect(screen.getByRole("button", { name: "Remove status filter" })).toBeInTheDocument();

    mockParams = new URLSearchParams("");
    rerender(<CallsPage />);
    await act(async () => {});
    expect(useExecutions).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ status: "failed" }),
      expect.anything()
    );
  });

  it("manual agent pick writes ?agent= and resets page", async () => {
    useExecutions.mockReturnValue({
      data: [execution("exec-1")],
      isLoading: false,
      error: null,
      refetch: jest.fn(),
      isFetching: false,
    });
    render(<CallsPage />);
    await act(async () => {});
    const agentSelect = screen.getByRole("combobox", { name: "Filter by agent" });
    await act(async () => {
      fireEvent.change(agentSelect, { target: { value: "agent-2" } });
    });
    expect(replaceMock).toHaveBeenLastCalledWith(expect.stringContaining("agent=agent-2"), { scroll: false });
    expect(replaceMock).toHaveBeenLastCalledWith(expect.not.stringContaining("page="), { scroll: false });
  });
});
