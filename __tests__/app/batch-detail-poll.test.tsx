import { Suspense } from "react";
import { render, screen, act } from "@testing-library/react";
import BatchDetailPage from "@/app/batches/[id]/page";

const batchRunning = {
  batch_id: "b-1",
  agent_id: "agent-1",
  name: "Festive",
  status: "running",
  stats: { total: 10, completed: 4, failed: 1, queued: 5 },
  created_at: new Date().toISOString(),
  schedule_at: null,
  calling_hours: null,
};
const batchDone = { ...batchRunning, status: "completed" };

const useBatchMock = jest.fn();
const useBatchExecutionsMock = jest.fn();

jest.mock("@/services/platform/batches", () => ({
  useBatch: (...args: unknown[]) => useBatchMock(...args),
  useBatchExecutions: (...args: unknown[]) => useBatchExecutionsMock(...args),
  useStartBatch: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useStopBatch: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useRetryFailed: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));
jest.mock("@/services/api", () => ({
  useAgents: () => ({ data: [{ agent_id: "agent-1", agent_name: "Clinic" }] }),
}));
jest.mock("@/services/platform/executions", () => ({
  useExecution: () => ({ data: null, isLoading: false }),
}));

describe("batch detail polling", () => {
  beforeEach(() => {
    useBatchMock.mockReset();
    useBatchExecutionsMock.mockReset();
    useBatchMock.mockReturnValue({ data: batchRunning, isLoading: false, error: null, refetch: jest.fn() });
    useBatchExecutionsMock.mockReturnValue({ data: [], refetch: jest.fn() });
  });

  async function renderDetail() {
    let tree: ReturnType<typeof render> | undefined;
    await act(async () => {
      tree = render(
        <Suspense fallback={<p>loading</p>}>
          <BatchDetailPage params={Promise.resolve({ id: "b-1" })} />
        </Suspense>
      );
    });
    // Flush the `use()` promise resolution.
    await act(async () => {});
    return tree!;
  }

  it("polls via refetchInterval function clock while running (no setInterval effect)", async () => {
    await renderDetail();
    expect(screen.getByText("Festive")).toBeInTheDocument();
    // Batch clock is a function inspecting cached status.
    const batchClock = useBatchMock.mock.calls[0][2]?.refetchInterval;
    expect(typeof batchClock).toBe("function");
    expect(batchClock(batchRunning)).toBe(3000);
    expect(batchClock(batchDone)).toBe(false);
    // Executions clock follows the sibling batch status.
    expect(useBatchExecutionsMock.mock.calls[0][2]?.refetchInterval).toBe(3000);
  });

  it("stops polling when completed", async () => {
    useBatchMock.mockReturnValue({ data: batchDone, isLoading: false, error: null, refetch: jest.fn() });
    await renderDetail();
    const batchClock = useBatchMock.mock.calls[0][2]?.refetchInterval;
    expect(batchClock(batchDone)).toBe(false);
    expect(useBatchExecutionsMock.mock.calls[0][2]?.refetchInterval).toBe(false);
  });
});
