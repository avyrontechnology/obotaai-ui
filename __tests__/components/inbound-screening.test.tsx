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

describe("execution inbound_screening schema (spec 0047, PROVISIONAL)", () => {
  it("parses blocked/spam/passed decisions with reason copy", () => {
    const cases = [
      { decision: "blocked", reason: "blocklisted_caller" },
      { decision: "spam", reason: "spam_protection_flag" },
      { decision: "passed", reason: "allowlisted_caller" },
    ] as const;
    for (const inbound_screening of cases) {
      const parsed = executionSchema.parse(baseExecution({ inbound_screening }));
      expect(parsed.inbound_screening).toEqual(inbound_screening);
    }
  });

  it("tolerates the absent field (pre-0047 records predate it)", () => {
    const parsed = executionSchema.parse(baseExecution());
    expect(parsed.inbound_screening).toBeUndefined();
  });

  it("tolerates explicit null", () => {
    const parsed = executionSchema.parse(baseExecution({ inbound_screening: null }));
    expect(parsed.inbound_screening).toBeNull();
  });

  it("degrades to undefined on shape mismatch (record parse never fails)", () => {
    const mismatches = [
      { decision: "quarantined", reason: "unknown_engine_verdict" },
      "junk-string",
      42,
      { reason: "decision_missing" },
      { decision: "blocked", reason: 7 },
    ];
    for (const inbound_screening of mismatches) {
      const parsed = executionSchema.parse(baseExecution({ inbound_screening }));
      expect(parsed.inbound_screening).toBeUndefined();
    }
  });
});

describe("ExecutionDrawer screening section", () => {
  beforeEach(() => {
    useExecution.mockReset();
  });

  it("blocked shows badge and reason copy", () => {
    mockExecution(
      baseExecution({ inbound_screening: { decision: "blocked", reason: "blocklisted_caller" } })
    );
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.getByTestId("screening-section")).toBeInTheDocument();
    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.getByText("blocklisted_caller")).toBeInTheDocument();
  });

  it("spam shows badge and reason copy", () => {
    mockExecution(
      baseExecution({ inbound_screening: { decision: "spam", reason: "spam_protection_flag" } })
    );
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.getByTestId("screening-section")).toBeInTheDocument();
    expect(screen.getByText("Spam")).toBeInTheDocument();
    expect(screen.getByText("spam_protection_flag")).toBeInTheDocument();
  });

  it("passed shows badge and reason copy", () => {
    mockExecution(
      baseExecution({ inbound_screening: { decision: "passed", reason: "allowlisted_caller" } })
    );
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.getByTestId("screening-section")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
    expect(screen.getByText("allowlisted_caller")).toBeInTheDocument();
  });

  it("null reason shows badge without copy", () => {
    mockExecution(
      baseExecution({ inbound_screening: { decision: "passed", reason: null } })
    );
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.getByTestId("screening-section")).toBeInTheDocument();
    expect(screen.getByText("Passed")).toBeInTheDocument();
  });

  it("absent field renders no screening section", () => {
    mockExecution(baseExecution());
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.queryByTestId("screening-section")).not.toBeInTheDocument();
  });

  it("mismatched shape hides the section instead of crashing", () => {
    mockExecution(baseExecution({ inbound_screening: { decision: "quarantined" } }));
    render(<ExecutionDrawer executionId="exec-1" onClose={() => {}} />);
    expect(screen.queryByTestId("screening-section")).not.toBeInTheDocument();
  });
});
