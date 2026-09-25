import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { ToolsConfigForm } from "@/components/settings/tools-config";
import { apiClient, ApiError } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

const CALENDAR_ROW = {
  tool_id: "function:calendar",
  kind: "function",
  name: "calendar",
  description: "Book slots.",
  parameters: {},
  url: "https://api.test/book",
  method: "POST",
  timeout_s: 10,
  deprecated: false,
  tenant_id: "tenant-1",
  created_at: "2026-09-03T00:00:00+00:00",
};

const NOTIFY_ROW = {
  tool_id: "webhook:pre_call_notify",
  kind: "webhook",
  name: "pre_call_notify",
  description: "Notify.",
  parameters: {},
  url: "https://hooks.test/notify",
  method: "POST",
  timeout_s: 10,
  deprecated: false,
  tenant_id: "system",
  created_at: "2026-09-03T00:00:00+00:00",
};

function renderSection() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Host() {
    const methods = useForm({ defaultValues: { agent_config: {} } });
    return (
      <QueryClientProvider client={client}>
        <FormProvider {...methods}>
          <ToolsConfigForm agentId="a1" />
        </FormProvider>
      </QueryClientProvider>
    );
  }
  return render(<Host />);
}

describe("ToolsConfigForm picker (spec 0029 slice 3)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith("/tools")) return Promise.resolve({ tools: [CALENDAR_ROW, NOTIFY_ROW] });
      if (endpoint.startsWith("/agent/")) return Promise.resolve({ agent_id: "a1", state: "updated" });
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
  });

  it("attaches a registry row via form state plus a full-array PATCH", async () => {
    renderSection();
    const attachButtons = await screen.findAllByRole("button", { name: "Attach" });
    fireEvent.click(attachButtons[0]);

    await waitFor(() => expect(mockedApiClient).toHaveBeenCalledWith(
      "/agent/a1",
      expect.objectContaining({ method: "PATCH" })
    ));
    const patchCall = mockedApiClient.mock.calls.find((call) => call[0] === "/agent/a1");
    const body = JSON.parse((patchCall[1] as RequestInit).body as string);
    // Component replaces wholesale — the complete new array, never a delta.
    expect(body.tasks_patch).toEqual([
      { task_index: 0, tools_config: { api_tools: expect.objectContaining({ tool_refs: ["function:calendar"] }) } },
    ]);
    // Immediate feedback from form state (no refetch round-trip needed).
    expect(await screen.findByLabelText("Detach calendar")).toBeInTheDocument();
  });

  it("detaches by sending the array without the id", async () => {
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith("/tools")) return Promise.resolve({ tools: [CALENDAR_ROW] });
      if (endpoint.startsWith("/agent/")) return Promise.resolve({ agent_id: "a1", state: "updated" });
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: "Attach" }));
    fireEvent.click(await screen.findByLabelText("Detach calendar"));

    await waitFor(() => {
      const patchCalls = mockedApiClient.mock.calls.filter((call) => call[0] === "/agent/a1");
      expect(patchCalls.length).toBeGreaterThanOrEqual(2);
      const last = JSON.parse((patchCalls[patchCalls.length - 1][1] as RequestInit).body as string);
      expect(last.tasks_patch[0].tools_config.api_tools.tool_refs).toEqual([]);
    });
  });

  it("attaches webhooks by name with the row ref", async () => {
    renderSection();
    const webhookButtons = await screen.findAllByRole("button", { name: "pre_call_notify" });
    fireEvent.click(webhookButtons[0]);

    await waitFor(() => expect(mockedApiClient).toHaveBeenCalledWith(
      "/agent/a1",
      expect.objectContaining({ method: "PATCH" })
    ));
    const patchCall = mockedApiClient.mock.calls.find((call) => call[0] === "/agent/a1");
    const body = JSON.parse((patchCall[1] as RequestInit).body as string);
    expect(body.tasks_patch[0].tools_config.api_tools.tools_params).toEqual({
      pre_call_notify: { pre_call_webhook_ref: "webhook:pre_call_notify" },
    });
    expect(await screen.findByLabelText("Remove webhook pre_call_notify")).toBeInTheDocument();
  });

  it("shows the backend-missing notice when the registry 404s", async () => {
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith("/tools")) return Promise.reject(new ApiError("Not Found", 404));
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
    renderSection();
    expect(await screen.findByText(/registry unavailable on this backend/)).toBeInTheDocument();
  });

  it("validates tenant tool input client-side", async () => {
    renderSection();
    fireEvent.click(await screen.findByRole("button", { name: /New tenant tool/ }));
    fireEvent.click(screen.getByRole("button", { name: "Create tenant tool" }));
    expect(await screen.findByText("Give the tool a name.")).toBeInTheDocument();
  });
});
