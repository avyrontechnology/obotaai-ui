import { render, screen } from "@testing-library/react";
import { KbManager } from "@/components/library/kb-manager";

const agents = [
  { agent_id: "agent-1", agent_name: "Clinic" },
  { agent_id: "agent-2", agent_name: "Sales" },
];

jest.mock("@/services/api", () => ({
  useAgents: jest.fn(),
}));
jest.mock("@/services/platform/knowledgebases", () => ({
  useKnowledgeBases: jest.fn(),
  useCreateKnowledgeBase: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useAttachKnowledgeBase: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDetachKnowledgeBase: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useDeleteKnowledgeBase: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useAgents } = require("@/services/api") as { useAgents: jest.Mock };
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { useKnowledgeBases } = require("@/services/platform/knowledgebases") as {
  useKnowledgeBases: jest.Mock;
};

describe("KbManager", () => {
  beforeEach(() => {
    useAgents.mockReturnValue({ data: agents });
    useKnowledgeBases.mockReturnValue({ data: [], isLoading: false, error: null, refetch: jest.fn() });
  });

  it("shares ONE agent aggregate across rows (no per-row useAgents)", () => {
    const kbs = [
      { kb_id: "kb-1", name: "Policy", sources: [], status: "ready", agent_ids: [] },
      { kb_id: "kb-2", name: "FAQ", sources: [], status: "ready", agent_ids: ["agent-1"] },
    ];
    useKnowledgeBases.mockReturnValue({ data: kbs, isLoading: false, error: null, refetch: jest.fn() });
    render(<KbManager />);
    expect(screen.getByText("Policy")).toBeInTheDocument();
    expect(screen.getByText("FAQ")).toBeInTheDocument();
    // Parent owns the single useAgents call; rows receive agents as props.
    expect(useAgents).toHaveBeenCalledTimes(1);
  });

  it("shows loading skeleton, error retry, and empty state holes", () => {
    useKnowledgeBases.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: jest.fn() });
    const { unmount } = render(<KbManager />);
    expect(document.querySelector(".animate-pulse")).not.toBeNull();
    unmount();

    const refetch = jest.fn();
    useKnowledgeBases.mockReturnValue({ data: undefined, isLoading: false, error: new Error("down"), refetch });
    render(<KbManager />);
    expect(screen.getByText(/Failed to load knowledge bases/)).toBeInTheDocument();
  });

  it("empty fleet uses EmptyState with icon title", () => {
    useKnowledgeBases.mockReturnValue({ data: [], isLoading: false, error: null, refetch: jest.fn() });
    render(<KbManager />);
    expect(screen.getByText("No knowledge bases yet")).toBeInTheDocument();
  });

  it("action buttons carry focus rings and cursor-pointer", () => {
    const kbs = [{ kb_id: "kb-1", name: "Policy", sources: [], status: "ready", agent_ids: [] }];
    useKnowledgeBases.mockReturnValue({ data: kbs, isLoading: false, error: null, refetch: jest.fn() });
    render(<KbManager />);
    const del = screen.getByRole("button", { name: "Delete Policy" });
    expect(del.className).toMatch(/cursor-pointer/);
    expect(del.className).toMatch(/focus-visible:ring/);
    expect(del.className).toMatch(/duration-200/);
  });
});
