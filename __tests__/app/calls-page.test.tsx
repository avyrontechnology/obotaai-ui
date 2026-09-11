import { render, screen, fireEvent, act } from "@testing-library/react";
import CallsPage from "@/app/calls/page";

let mockParams = new URLSearchParams("");
const replaceMock = jest.fn();

jest.mock("@/services/platform/executions", () => ({
  useExecutions: jest.fn(),
  useLatencyStats: () => ({ data: null, isLoading: false }),
  useExecution: jest.fn(() => ({ data: null, isLoading: false })),
  useExecutionStats: () => ({ data: null, isLoading: false }),
}));
jest.mock("@/services/api", () => ({
  useAgents: () => ({ data: [{ agent_id: "agent-1", agent_name: "Clinic" }] }),
}));
jest.mock("next/navigation", () => ({
  useSearchParams: () => mockParams,
  useRouter: () => ({ replace: replaceMock, push: jest.fn() }),
  usePathname: () => "/calls",
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useExecutions, useExecution } = require("@/services/platform/executions") as {
  useExecutions: jest.Mock;
  useExecution: jest.Mock;
};

function execution(id: string, overrides: Record<string, unknown> = {}) {
  return {
    execution_id: id,
    agent_id: "agent-1",
    to_number: "+9112345",
    status: "completed",
    duration_s: 42,
    latency: null,
    started_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("CallsPage", () => {
  beforeEach(() => {
    useExecutions.mockReset();
    useExecution.mockReset();
    useExecution.mockReturnValue({ data: null, isLoading: false });
    mockParams = new URLSearchParams("");
    replaceMock.mockReset();
  });

  function renderWith(rows: unknown[]) {
    useExecutions.mockReturnValue({ data: rows, isLoading: false, error: null, refetch: jest.fn() });
    return render(<CallsPage />);
  }

  it("lists executions with agent names", async () => {
    renderWith([execution("exec-1", { to_number: "+911111" }), execution("exec-2", { to_number: "+912222" })]);
    await act(async () => {});
    expect(screen.getByText("+911111")).toBeInTheDocument();
    expect(screen.getByText("+912222")).toBeInTheDocument();
    expect(screen.getAllByText("Clinic").length).toBeGreaterThan(0);
  });

  it("survives null numbers and searches safely", async () => {
    renderWith([execution("exec-1", { to_number: null })]);
    await act(async () => {});
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
    const search = screen.getByPlaceholderText("Filter this page by number, execution or agent…");
    await act(async () => {
      fireEvent.change(search, { target: { value: "exec-1" } });
    });
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("pages with offset and disables prev on page one", async () => {
    // 26 rows = 25 displayed + 1 probe proving another page exists.
    const full = Array.from({ length: 26 }, (_, i) => execution(`exec-${i}`));
    renderWith(full);
    await act(async () => {});
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Previous page")).toBeDisabled();
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Next page"));
    });
    expect(useExecutions).toHaveBeenLastCalledWith(
      expect.objectContaining({ limit: 26, offset: 25 }),
      expect.objectContaining({ refetchInterval: false })
    );
    expect(screen.getByText("Page 2")).toBeInTheDocument();
  });

  it("hides the pager on a short list", async () => {
    renderWith([execution("exec-1")]);
    await act(async () => {});
    expect(screen.queryByLabelText("Next page")).not.toBeInTheDocument();
  });

  it("opens the drawer from ?execution_id= with an Unknown caller title", async () => {
    mockParams = new URLSearchParams("execution_id=exec-9");
    useExecution.mockReturnValue({
      data: {
        ...execution("exec-9", { to_number: "unknown", direction: "inbound" }),
        from_number: null,
        batch_id: null,
        transcript: [],
        summary: null,
        extracted_data: {},
        variables: {},
        hangup_code: null,
        ended_at: null,
      },
      isLoading: false,
    });
    renderWith([execution("exec-9", { to_number: "unknown", direction: "inbound" })]);
    await act(async () => {});
    expect(screen.getByRole("dialog", { name: "Call details" })).toBeInTheDocument();
    expect(screen.getByText("Unknown caller")).toBeInTheDocument();
    expect(screen.getByLabelText("Close panel")).toBeInTheDocument();
  });

  it("writes ?execution_id= on row open and clears it on close", async () => {
    useExecution.mockReturnValue({ data: null, isLoading: false });
    const { rerender } = renderWith([execution("exec-1")]);
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Open call exec-1/ }));
    });
    expect(replaceMock).toHaveBeenLastCalledWith("/calls?execution_id=exec-1", { scroll: false });

    // Simulate the URL update landing, then close via the drawer button.
    mockParams = new URLSearchParams("execution_id=exec-1");
    rerender(<CallsPage />);
    await act(async () => {
      fireEvent.click(screen.getByLabelText("Close panel"));
    });
    expect(replaceMock).toHaveBeenLastCalledWith("/calls", { scroll: false });
  });
});
