import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm } from "react-hook-form";
import { PipelineToggle } from "@/components/settings/synthesizer-config";
import { apiClient } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

function renderToggle(opts: {
  agentType?: string;
  agentId?: string;
  taskIndex?: number;
  pipeline?: "asr" | "s2s" | "chat";
  channels?: string[];
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Host() {
    const methods = useForm({
      defaultValues: {
        channels: opts.channels ?? ["voice"],
        agent_config: { ...(opts.pipeline ? { pipeline: opts.pipeline } : {}) },
      },
    });
    return (
      <QueryClientProvider client={client}>
        <FormProvider {...methods}>
          <PipelineToggle agentId={opts.agentId} agentType={opts.agentType ?? "voice"} taskIndex={opts.taskIndex} />
        </FormProvider>
      </QueryClientProvider>
    );
  }
  return render(<Host />);
}

function lastPatchBody(): unknown {
  const calls = mockedApiClient.mock.calls.filter(([endpoint, opts]: [string, { method?: string }]) =>
    endpoint.startsWith("/agent/") && opts?.method === "PATCH"
  );
  return JSON.parse((calls.at(-1)?.[1] as { body: string }).body);
}

describe("PipelineToggle per-task switching (spec 0045)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.mockResolvedValue({ agent_id: "a1", state: "updated" });
  });

  it("addresses the given task index on flip", async () => {
    renderToggle({ agentId: "a1", taskIndex: 2, pipeline: "asr" });
    fireEvent.click(screen.getByRole("button", { name: /Realtime \(S2S\) pipeline/ }));
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
    expect(lastPatchBody()).toEqual({ tasks_patch: [{ task_index: 2, pipeline: "s2s" }] });
  });

  it("offers chat iff the staged channels include it", () => {
    const { unmount } = renderToggle({ channels: ["voice"] });
    expect(screen.queryByRole("button", { name: /Chat pipeline/ })).not.toBeInTheDocument();
    unmount();
    renderToggle({ channels: ["voice", "chat"], pipeline: "asr" });
    expect(screen.getByRole("button", { name: /Chat pipeline/ })).toBeInTheDocument();
  });

  it("pressing chat PATCHes the chat pointer on the addressed task", async () => {
    renderToggle({ agentId: "a1", taskIndex: 1, channels: ["voice", "chat"], pipeline: "asr" });
    fireEvent.click(screen.getByRole("button", { name: /Chat pipeline/ }));
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
    expect(lastPatchBody()).toEqual({ tasks_patch: [{ task_index: 1, pipeline: "chat" }] });
  });

  it("clear sends the per-task clear op and drops the override", async () => {
    renderToggle({ agentId: "a1", taskIndex: 0, pipeline: "s2s" });
    fireEvent.click(screen.getByRole("button", { name: /Clear pipeline override/ }));
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
    expect(lastPatchBody()).toEqual({ tasks_patch: [{ task_index: 0, clear: ["pipeline"] }] });
  });

  it("hides the clear action with no explicit pointer", () => {
    renderToggle({ agentType: "voice" });
    expect(screen.queryByRole("button", { name: /Clear pipeline override/ })).not.toBeInTheDocument();
  });
});
