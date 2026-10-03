import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrgTools } from "@/components/settings/org-tools";
import { ApiError } from "@/lib/api-client";
import { notify } from "@/lib/notify";

jest.mock("@/services/platform/tools", () => ({
  useTools: jest.fn(),
  useCreateTenantTool: jest.fn(),
  useUpdateTenantTool: jest.fn(),
  useDeleteTenantTool: jest.fn(),
}));

jest.mock("@/lib/rbac", () => ({
  useCan: () => true,
  minRoleFor: () => "member",
}));

jest.mock("@/lib/notify", () => ({
  notify: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));

const hooks = jest.requireMock("@/services/platform/tools") as {
  useTools: jest.Mock;
  useCreateTenantTool: jest.Mock;
  useUpdateTenantTool: jest.Mock;
  useDeleteTenantTool: jest.Mock;
};

const FUNCTION_ROW = {
  tool_id: "function:calendar",
  kind: "function",
  name: "calendar",
  description: "Book slots.",
  parameters: {},
  url: "https://api.test/book",
  method: "POST",
  auth_ref: null,
  timeout_s: 10,
  deprecated: false,
  tenant_id: "tenant-1",
  created_at: "2026-09-03T00:00:00+00:00",
};

const SYSTEM_ROW = {
  tool_id: "webhook:pre_call_notify",
  kind: "webhook",
  name: "pre_call_notify",
  description: "Notify.",
  parameters: {},
  url: "https://hooks.test/notify",
  method: "POST",
  auth_ref: null,
  timeout_s: 10,
  deprecated: false,
  tenant_id: "system",
  created_at: "2026-09-03T00:00:00+00:00",
};

const DEPRECATED_ROW = {
  tool_id: "function:old_lookup",
  kind: "function",
  name: "old_lookup",
  description: "Legacy lookup.",
  parameters: {},
  url: null,
  method: "POST",
  auth_ref: null,
  timeout_s: 10,
  deprecated: true,
  tenant_id: "tenant-1",
  created_at: "2026-09-03T00:00:00+00:00",
};

function mutationStub() {
  return {
    mutate: jest.fn(),
    mutateAsync: jest.fn().mockResolvedValue({}),
    isPending: false,
  };
}

function renderTools() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <OrgTools />
    </QueryClientProvider>
  );
}

describe("OrgTools registry section", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    hooks.useTools.mockReturnValue({
      data: [FUNCTION_ROW, SYSTEM_ROW, DEPRECATED_ROW],
      isLoading: false,
    });
    hooks.useCreateTenantTool.mockReturnValue(mutationStub());
    hooks.useUpdateTenantTool.mockReturnValue(mutationStub());
    hooks.useDeleteTenantTool.mockReturnValue(mutationStub());
  });

  it("lists registry rows from useTools", () => {
    renderTools();
    expect(screen.getByText("calendar")).toBeInTheDocument();
    expect(screen.getByText("pre_call_notify")).toBeInTheDocument();
    expect(screen.getByText("old_lookup")).toBeInTheDocument();
  });

  it("keeps system rows read-only with no edit or delete buttons", () => {
    renderTools();
    // Tenant rows stay editable.
    expect(screen.getByLabelText("Edit tool calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Delete tool calendar")).toBeInTheDocument();
    // System rows show a read-only badge and no write buttons.
    expect(screen.getByLabelText("System tool pre_call_notify is read-only")).toBeInTheDocument();
    expect(screen.queryByLabelText("Edit tool pre_call_notify")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete tool pre_call_notify")).not.toBeInTheDocument();
  });

  it("marks deprecated rows with a badge and stale warning", () => {
    renderTools();
    expect(screen.getAllByText("Deprecated").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/hidden from pickers, attached agents keep resolving/)).toBeInTheDocument();
  });

  it("create dialog validates an empty name", async () => {
    renderTools();
    fireEvent.click(screen.getByRole("button", { name: "New tool" }));
    fireEvent.click(screen.getByRole("button", { name: "Create tool" }));
    expect(await screen.findByText(/at least 1 character/i)).toBeInTheDocument();
    expect(hooks.useCreateTenantTool().mutateAsync).not.toHaveBeenCalled();
  });

  it("delete conflict toasts the attached-agent count with detach guidance", async () => {
    const conflict = new ApiError(
      "Tool 'function:calendar' is still attached to 2 agent(s); detach it first.",
      409,
      { referencing_agents: 2 }
    );
    hooks.useDeleteTenantTool.mockReturnValue({
      mutate: jest.fn((_: unknown, opts?: { onError?: (e: unknown) => void }) => opts?.onError?.(conflict)),
      mutateAsync: jest.fn(),
      isPending: false,
    });
    renderTools();
    fireEvent.click(screen.getByLabelText("Delete tool calendar"));
    fireEvent.click(screen.getByLabelText("Confirm delete calendar"));
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(
        expect.stringContaining("detach from agents first"),
        conflict
      )
    );
  });

  it("expands a row to show the parameters schema and tool id", async () => {
    renderTools();
    fireEvent.click(screen.getByLabelText("Show calendar schema"));
    expect(await screen.findByText("Parameters schema")).toBeInTheDocument();
    expect(screen.getByLabelText("Copy tool id function:calendar")).toBeInTheDocument();
  });

  it("delete conflict also names the attached-agent count", async () => {
    const conflict = new ApiError(
      "Tool 'function:calendar' is still attached to 2 agent(s); detach it first.",
      409,
      { referencing_agents: 2 }
    );
    hooks.useDeleteTenantTool.mockReturnValue({
      mutate: jest.fn((_: unknown, opts?: { onError?: (e: unknown) => void }) => opts?.onError?.(conflict)),
      mutateAsync: jest.fn(),
      isPending: false,
    });
    renderTools();
    fireEvent.click(screen.getByLabelText("Delete tool calendar"));
    fireEvent.click(screen.getByLabelText("Confirm delete calendar"));
    await waitFor(() =>
      expect(notify.error).toHaveBeenCalledWith(expect.stringContaining("2 agent"), conflict)
    );
  });
});
