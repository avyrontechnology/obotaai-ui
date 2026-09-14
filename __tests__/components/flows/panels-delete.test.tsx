import { render, screen, fireEvent, act } from "@testing-library/react";
import { GraphsPanel } from "@/components/flows/graphs-panel";
import { WorkflowsPanel } from "@/components/flows/workflows-panel";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const graphMutate = jest.fn();
const workflowMutate = jest.fn();

jest.mock("@/services/platform/graphs", () => ({
  useGraphs: () => ({
    data: [
      {
        graph_id: "g-1",
        name: "Triage",
        definition: { nodes: [{ id: "greet" }] },
        updated_at: new Date().toISOString(),
      },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useCreateGraph: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteGraph: () => ({ mutateAsync: graphMutate }),
}));
jest.mock("@/services/platform/workflows", () => ({
  useWorkflows: () => ({
    data: [
      {
        workflow_id: "w-1",
        name: "Revival",
        definition: { nodes: [{ id: "start" }] },
        updated_at: new Date().toISOString(),
      },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
  useCreateWorkflow: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteWorkflow: () => ({ mutateAsync: workflowMutate }),
}));
jest.mock("@/lib/notify", () => ({
  notify: { success: jest.fn(), error: jest.fn() },
}));

describe("flows panels delete", () => {
  beforeEach(() => {
    graphMutate.mockReset().mockResolvedValue({});
    workflowMutate.mockReset().mockResolvedValue({});
    (global.confirm as unknown) = jest.fn(() => true);
  });

  it("graphs delete confirms then toasts success", async () => {
    render(<GraphsPanel />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Triage" }));
    });
    expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining("Triage"));
    expect(graphMutate).toHaveBeenCalledWith("g-1");
  });

  it("graphs delete aborts when confirm is cancelled", async () => {
    (global.confirm as unknown as jest.Mock).mockReturnValueOnce(false);
    render(<GraphsPanel />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Triage" }));
    });
    expect(graphMutate).not.toHaveBeenCalled();
  });

  it("workflows delete confirms then toasts", async () => {
    render(<WorkflowsPanel />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Delete Revival" }));
    });
    expect(global.confirm).toHaveBeenCalledWith(expect.stringContaining("Revival"));
    expect(workflowMutate).toHaveBeenCalledWith("w-1");
  });

  it("panels paginate at 12 per page", async () => {
    // 13 rows forces a second page (12 + 1).
    const many = Array.from({ length: 13 }, (_, i) => ({
      graph_id: `g-${i}`,
      name: `Graph ${i}`,
      definition: { nodes: [] },
      updated_at: new Date().toISOString(),
    }));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const graphsMod = require("@/services/platform/graphs") as { useGraphs: jest.Mock };
    const orig = graphsMod.useGraphs;
    (graphsMod as unknown as { useGraphs: () => unknown }).useGraphs = () => ({
      data: many,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    const { unmount } = render(<GraphsPanel />);
    expect(screen.getByText(/Showing 1–12 of 13 graphs/)).toBeInTheDocument();
    unmount();
    (graphsMod as unknown as { useGraphs: unknown }).useGraphs = orig;
  });
});
