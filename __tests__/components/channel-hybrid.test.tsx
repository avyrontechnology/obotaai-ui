import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { ChannelSwitcher } from "@/components/settings/channel-config";
import { useUpdateAgent } from "@/services/api";
import { apiClient } from "@/lib/api-client";
import type { AgentData } from "@/lib/schemas/agent";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

interface HybridDefaults {
  agent_type: string;
  channels: string[];
  agent_config: Record<string, unknown>;
}

/**
 * Minimal mirror of the configure page save path (spec 0045 Slice B):
 * ChannelSwitcher stages form-root `agent_type`/`channels`, Save persists
 * via useUpdateAgent → PUT /agent/:id (toCreateAgentPayload). Hooks below
 * the component are real; only the transport (apiClient) is mocked.
 */
function ChannelsProbe() {
  const { control } = useFormContext();
  const value = useWatch({ control, name: "channels" }) as unknown;
  return <span data-testid="channels-probe">{JSON.stringify(value ?? null)}</span>;
}

function renderHybrid(defaults: HybridDefaults) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Host() {
    const methods = useForm<HybridDefaults>({ defaultValues: defaults });
    const update = useUpdateAgent();
    const onSave = async () => {
      const v = methods.getValues();
      await update.mutateAsync({
        id: "agent-hybrid",
        data: {
          agent_name: "Hybrid Agent",
          agent_type: v.agent_type as AgentData["agent_type"],
          agent_prompts: { system_prompt: "You are a helpful assistant." },
          agent_config: (v.agent_config ?? {}) as AgentData["agent_config"],
          ...(v.channels ? { channels: v.channels } : {}),
        },
      });
    };
    return (
      <FormProvider {...methods}>
        <ChannelSwitcher agentId="agent-hybrid" agentType="voice" />
        <ChannelsProbe />
        <button type="button" onClick={() => void onSave()}>
          Save Configuration
        </button>
      </FormProvider>
    );
  }
  return render(
    <QueryClientProvider client={client}>
      <Host />
    </QueryClientProvider>
  );
}

function putBody(): Record<string, { channels?: string[] }> {
  const call = mockedApiClient.mock.calls.find(
    (args: unknown[]) => args[0] === "/agent/agent-hybrid"
  );
  expect(call).toBeDefined();
  const options = call?.[1] as { method: string; body: string };
  expect(options.method).toBe("PUT");
  return JSON.parse(options.body) as Record<string, { channels?: string[] }>;
}

describe("ChannelSwitcher hybrid emission e2e (spec 0045 Slice B)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedApiClient.mockResolvedValue({});
  });

  it("carries staged [voice,chat] to the PUT payload on save", async () => {
    renderHybrid({ agent_type: "voice", channels: ["voice"], agent_config: {} });
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice"]');

    // Stage hybrid: both checkboxes checked.
    fireEvent.click(screen.getByRole("checkbox", { name: "Chat channel" }));
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice","chat"]');

    fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());

    const payload = putBody();
    expect(payload.agent_config.channels).toEqual(["voice", "chat"]);
  });

  it("shows the staged banner with hybrid copy on divergence", () => {
    renderHybrid({ agent_type: "voice", channels: ["voice"], agent_config: {} });
    // In sync with the server snapshot: no banner, no hybrid copy.
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByText(/\(hybrid\)/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: "Chat channel" }));

    // Active-channels line names the hybrid pair…
    expect(screen.getByText(/voice \+ chat \(hybrid\)/)).toBeInTheDocument();
    // …and the staged-pending banner carries the channel divergence.
    const banner = screen.getByRole("status");
    expect(banner).toHaveTextContent("Staged changes pending save.");
    expect(banner).toHaveTextContent("Channels: voice → voice + chat");
  });

  it("treats unchecking the last channel as a no-op — the form never emits []", async () => {
    renderHybrid({ agent_type: "voice", channels: ["voice"], agent_config: {} });
    const voice = screen.getByRole("checkbox", { name: "Voice channel" });
    const chat = screen.getByRole("checkbox", { name: "Chat channel" });

    // Single channel: unchecking it is a no-op.
    fireEvent.click(voice);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice"]');
    expect(voice).toBeChecked();

    // Hybrid, then strip down to chat alone…
    fireEvent.click(chat);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["voice","chat"]');
    fireEvent.click(voice);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["chat"]');

    // …and the last remaining channel cannot be unchecked either.
    fireEvent.click(chat);
    expect(screen.getByTestId("channels-probe")).toHaveTextContent('["chat"]');
    expect(chat).toBeChecked();

    // Saving after the no-op attempts persists the retained channel.
    fireEvent.click(screen.getByRole("button", { name: "Save Configuration" }));
    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
    expect(putBody().agent_config.channels).toEqual(["chat"]);
  });
});
