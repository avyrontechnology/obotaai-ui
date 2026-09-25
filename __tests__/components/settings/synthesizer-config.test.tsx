import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { PipelineToggle } from "@/components/settings/synthesizer-config";
import { apiClient } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

function renderToggle(
  agentType: string,
  opts: { pipeline?: "asr" | "s2s"; s2s?: boolean; agentId?: string } = {}
) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Probe() {
    const { control } = useFormContext();
    const value = useWatch({ control, name: "agent_config.pipeline" }) as string | undefined;
    return <span data-testid="pipeline-probe">{value ?? "∅"}</span>;
  }
  function Host() {
    const methods = useForm({
      defaultValues: {
        agent_config: {
          ...(opts.pipeline ? { pipeline: opts.pipeline } : {}),
          ...(opts.s2s ? { s2s: { provider: "openai_realtime" } } : {}),
        },
      },
    });
    return (
      <QueryClientProvider client={client}>
        <FormProvider {...methods}>
          <PipelineToggle agentId={opts.agentId} agentType={agentType} />
          <Probe />
        </FormProvider>
      </QueryClientProvider>
    );
  }
  return render(<Host />);
}

describe("PipelineToggle (spec 0028)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.mockResolvedValue({ agent_id: "a1", state: "updated" });
  });

  it("infers ASR when no pointer and no s2s block exist", () => {
    renderToggle("voice");
    expect(screen.getByText(/Active: ASR pipeline \(inferred\)/)).toBeInTheDocument();
  });

  it("infers realtime when an s2s block is present without a pointer", () => {
    renderToggle("voice", { s2s: true });
    expect(screen.getByText(/Active: Realtime \(S2S\) \(inferred\)/)).toBeInTheDocument();
  });

  it("falls back to form state without an agentId", () => {
    renderToggle("voice");
    fireEvent.click(screen.getByRole("button", { name: /Realtime \(S2S\) pipeline/ }));
    expect(screen.getByTestId("pipeline-probe")).toHaveTextContent("s2s");
    expect(mockedApiClient).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /ASR pipeline/ }));
    expect(screen.getByTestId("pipeline-probe")).toHaveTextContent("asr");
  });

  it("flips via PATCH tasks_patch without a full resend", async () => {
    renderToggle("voice", { agentId: "a1" });
    fireEvent.click(screen.getByRole("button", { name: /Realtime \(S2S\) pipeline/ }));

    expect(await screen.findByText(/Active: Realtime \(S2S\) \(explicit\)/)).toBeInTheDocument();
    expect(mockedApiClient).toHaveBeenCalledWith(
      "/agent/a1",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ tasks_patch: [{ task_index: 0, pipeline: "s2s" }] }),
      })
    );
    expect(screen.getByTestId("pipeline-probe")).toHaveTextContent("s2s");
  });

  it("reflects a stored explicit pointer", () => {
    renderToggle("s2s", { pipeline: "s2s", s2s: true });
    expect(screen.getByText(/Active: Realtime \(S2S\) \(explicit\)/)).toBeInTheDocument();
  });

  it("disables flipping while the form holds unsaved edits", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function Host() {
      const methods = useForm({ defaultValues: { agent_config: { llm: { model: "gpt-4o" } } } });
      return (
        <QueryClientProvider client={client}>
          <FormProvider {...methods}>
            <input {...methods.register("agent_config.llm.model")} aria-label="Probe model" />
            <PipelineToggle agentId="a1" agentType="voice" />
          </FormProvider>
        </QueryClientProvider>
      );
    }
    render(<Host />);
    // Clean form: flip available.
    expect(screen.getByRole("button", { name: /Realtime \(S2S\) pipeline/ })).toBeEnabled();
    fireEvent.change(screen.getByLabelText("Probe model"), { target: { value: "gpt-4o-mini" } });
    // Dirty form: flip blocked so the refetch reset cannot wipe the edit.
    expect(screen.getByRole("button", { name: /Realtime \(S2S\) pipeline/ })).toBeDisabled();
    expect(screen.getByText(/Save or discard edits to flip/)).toBeInTheDocument();
  });

  it("renders nothing for text agents", () => {
    renderToggle("text");
    expect(screen.queryByRole("group", { name: "Engine pipeline" })).not.toBeInTheDocument();
  });
});
