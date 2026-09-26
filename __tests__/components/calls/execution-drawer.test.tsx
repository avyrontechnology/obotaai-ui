import { render, screen } from "@testing-library/react";
import { ExecutionDrawer } from "@/components/calls/execution-drawer";
import { executionSchema } from "@/lib/schemas/platform";

jest.mock("@/services/platform/executions", () => ({
  useExecution: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useExecution } = require("@/services/platform/executions") as {
  useExecution: jest.Mock;
};

function baseExecution(overrides: Record<string, unknown> = {}) {
  return {
    execution_id: "exec-1",
    agent_id: "agent-1",
    batch_id: null,
    direction: "outbound" as const,
    to_number: "+911234",
    from_number: null,
    status: "completed" as const,
    variables: {},
    transcript: [],
    summary: null,
    extracted_data: {},
    latency: null,
    hangup_code: null,
    started_at: new Date().toISOString(),
    ended_at: null,
    duration_s: 12,
    ...overrides,
  };
}

function mockExecution(data: Record<string, unknown>) {
  useExecution.mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    refetch: jest.fn(),
  });
}

describe("execution recording schema", () => {
  it("parses all 4 recording statuses", () => {
    const statuses = ["recorded", "disabled", "failed", "pending_upload"] as const;
    for (const recording_status of statuses) {
      const parsed = executionSchema.parse(
        baseExecution({
          recording_status,
          recording_reason: recording_status === "recorded" ? "s3_upload_ok" : "upload_failed",
          recording_url: recording_status === "recorded" ? "https://example.com/rec.mp3" : null,
        })
      );
      expect(parsed.recording_status).toBe(recording_status);
    }
  });

  it("tolerates the absent triple (old records predate the fields)", () => {
    const parsed = executionSchema.parse(baseExecution());
    expect(parsed.recording_status).toBeUndefined();
    expect(parsed.recording_reason).toBeUndefined();
    expect(parsed.recording_url).toBeUndefined();
  });

  it("tolerates explicit nulls", () => {
    const parsed = executionSchema.parse(
      baseExecution({ recording_status: null, recording_reason: null, recording_url: null })
    );
    expect(parsed.recording_status).toBeNull();
    expect(parsed.recording_reason).toBeNull();
    expect(parsed.recording_url).toBeNull();
  });
});

describe("ExecutionDrawer recording section", () => {
  beforeEach(() => {
    useExecution.mockReset();
  });

  it("recorded shows badge, reason, and artifact link", () => {
    mockExecution(
      baseExecution({
        recording_status: "recorded",
        recording_reason: "s3_upload_ok",
        recording_url: "https://example.com/rec.mp3",
      })
    );
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.getByTestId("recording-section")).toBeInTheDocument();
    expect(screen.getByText("Recorded")).toBeInTheDocument();
    expect(screen.getByText("s3_upload_ok")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "Recording" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://example.com/rec.mp3");
  });

  it("failed shows reason without a link", () => {
    mockExecution(
      baseExecution({
        recording_status: "failed",
        recording_reason: "upload_failed",
        recording_url: null,
      })
    );
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.getByTestId("recording-section")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("upload_failed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Recording" })).not.toBeInTheDocument();
  });

  it("pending_upload shows badge without a link", () => {
    mockExecution(
      baseExecution({
        recording_status: "pending_upload",
        recording_reason: "upload_queued",
        recording_url: null,
      })
    );
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.getByTestId("recording-section")).toBeInTheDocument();
    expect(screen.getByText("Pending Upload")).toBeInTheDocument();
    expect(screen.getByText("upload_queued")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Recording" })).not.toBeInTheDocument();
  });

  it("absent triple renders no recording section", () => {
    mockExecution(baseExecution());
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.queryByTestId("recording-section")).not.toBeInTheDocument();
  });
});
