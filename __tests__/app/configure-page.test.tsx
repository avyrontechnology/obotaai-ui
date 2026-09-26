import { Suspense } from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import AgentConfigurePage from "@/app/agents/[id]/configure/page";
import { ApiError } from "@/lib/api-client";

jest.mock("@/services/api", () => ({
  useAgent: jest.fn(),
  useAgentPrompts: jest.fn(),
  useUpdateAgent: jest.fn(),
}));

jest.mock("@/lib/rbac", () => ({
  useCan: () => true,
  minRoleFor: () => "member",
}));

jest.mock("@/lib/notify", () => ({
  notify: { success: jest.fn(), error: jest.fn(), info: jest.fn(), loading: jest.fn(), dismiss: jest.fn() },
}));

jest.mock("@/components/settings/persona-config", () => ({
  PersonaConfigForm: () => <div>Persona section</div>,
}));
jest.mock("@/components/settings/transcriber-config", () => ({
  TranscriberConfigForm: () => <div>Transcriber section</div>,
}));
jest.mock("@/components/settings/synthesizer-config", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SynthesizerConfigForm: ({ agentType }: any) => <div>Synthesizer section type {String(agentType)}</div>,
}));
jest.mock("@/components/settings/llm-config", () => ({
  LLMConfigForm: () => <div>LLM section</div>,
}));
jest.mock("@/components/settings/rag-config", () => ({
  RAGConfigForm: () => <div>RAG section</div>,
}));
jest.mock("@/components/settings/call-behavior-config", () => ({
  CallBehaviorConfigForm: () => <div>Behavior section</div>,
}));
jest.mock("@/components/settings/tools-config", () => ({
  ToolsConfigForm: () => <div>Tools section</div>,
}));
jest.mock("@/components/settings/analytics-config", () => ({
  AnalyticsConfigForm: () => <div>Analytics section</div>,
}));
jest.mock("@/components/settings/inbound-config", () => ({
  InboundConfigForm: () => <div>Inbound section</div>,
}));

// Stand-in for Dev A's ChannelSwitcher (src/components/settings/channel-config).
// Contract under test: it writes the form-root `agent_type` (voice/text/s2s
// enum) + `channels` (string array) RHF fields and reads the staged
// `agentType` prop. Mocked (not the real component) to keep this suite
// focused on Dev C's page wiring per the task split.
jest.mock("@/components/settings/channel-config", () => ({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ChannelSwitcher: ({ agentId, agentType }: any) => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { useFormContext } = require("react-hook-form") as typeof import("react-hook-form");
      const { setValue } = useFormContext();
      return (
        <div>
          <p>
            Channel switcher for {String(agentId)} type {String(agentType)}
          </p>
          <button
            type="button"
            onClick={() => setValue("agent_type", "text", { shouldDirty: true, shouldValidate: true })}
          >
            Stage text type
          </button>
          <button
            type="button"
            onClick={() => setValue("channels", ["chat"], { shouldDirty: true, shouldValidate: true })}
          >
            Stage chat channels
          </button>
        </div>
      );
    },
  })
);

// eslint-disable-next-line @typescript-eslint/no-require-imports
const apiMocks = require("@/services/api") as {
  useAgent: jest.Mock;
  useAgentPrompts: jest.Mock;
  useUpdateAgent: jest.Mock;
};
const mockMutateAsync = jest.fn();

const voiceAgent = {
  agent_id: "agent-1",
  agent_name: "Test Agent",
  agent_type: "voice",
  agent_config: {},
  agent_prompts: {
    system_prompt: "You are a helpful assistant with a sufficiently long prompt.",
    welcome_message: "Hello",
  },
  channels: ["voice"],
};

function renderConfigurePage() {
  const params = Promise.resolve({ id: "agent-1" });
  // The page unwraps `params` via React 19 `use()`, which suspends until the
  // promise resolves — the render must be awaited inside async act, otherwise
  // the tree stays on the Suspense fallback and findBy* never resolves.
  return act(async () => {
    render(
      <Suspense fallback={<div>loading</div>}>
        <AgentConfigurePage params={params} />
      </Suspense>
    );
  });
}

describe("AgentConfigurePage (Dev C: staged type/channels)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockMutateAsync.mockReset().mockResolvedValue({});
    apiMocks.useAgent.mockReturnValue({ data: voiceAgent, isLoading: false, error: null, refetch: jest.fn() });
    apiMocks.useAgentPrompts.mockReturnValue({ data: {} });
    apiMocks.useUpdateAgent.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
  });

  it("staged type switch updates header badge + Test link without teleporting tabs", async () => {
    await renderConfigurePage();
    expect(await screen.findByTestId("agent-type-badge")).toHaveTextContent("voice");
    expect(screen.getByRole("link", { name: "Test" })).toHaveAttribute(
      "href",
      "/playground?agent=agent-1&mode=talk"
    );

    fireEvent.click(screen.getByRole("tab", { name: /channel/i }));
    expect(await screen.findByText("Channel switcher for agent-1 type voice")).toBeInTheDocument();

    // Stage text through the form-root field (what Dev A's switcher writes).
    fireEvent.click(screen.getByRole("button", { name: "Stage text type" }));

    // Header badge + Test link + section props follow the STAGED type...
    expect(await screen.findByText("Channel switcher for agent-1 type text")).toBeInTheDocument();
    expect(screen.getByTestId("agent-type-badge")).toHaveTextContent("text");
    expect(screen.getByRole("link", { name: "Test" })).toHaveAttribute(
      "href",
      "/playground?agent=agent-1&mode=chat"
    );

    // ...but tabs never teleport: still on channel, voice-only tabs persist.
    expect(screen.getByRole("tab", { name: /channel/i })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: /transcriber/i })).toBeInTheDocument();

    // Section props follow the staged type too.
    fireEvent.click(screen.getByRole("tab", { name: /TTS/ }));
    expect(await screen.findByText("Synthesizer section type text")).toBeInTheDocument();
  });

  it("submit carries staged agent_type/channels with stored fallback", async () => {
    await renderConfigurePage();
    await screen.findByTestId("agent-type-badge");

    // Untouched submit round-trips the stored record.
    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(1));
    const first = mockMutateAsync.mock.calls[0][0] as { id: string; data: Record<string, unknown> };
    expect(first.id).toBe("agent-1");
    expect(first.data["agent_type"]).toBe("voice");
    expect(first.data["channels"]).toEqual(["voice"]);

    // Staged submit carries the form values.
    fireEvent.click(screen.getByRole("tab", { name: /channel/i }));
    fireEvent.click(await screen.findByRole("button", { name: "Stage text type" }));
    fireEvent.click(screen.getByRole("button", { name: "Stage chat channels" }));
    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalledTimes(2));
    const second = mockMutateAsync.mock.calls[1][0] as { id: string; data: Record<string, unknown> };
    expect(second.id).toBe("agent-1");
    expect(second.data["agent_type"]).toBe("text");
    expect(second.data["channels"]).toEqual(["chat"]);
  });

  it("renders channel-allowlist rejections with the valid list", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError("Channels rejected: sms is not servable", 400, {
        channels: ["sms"],
        valid: ["voice", "chat"],
      })
    );
    await renderConfigurePage();
    await screen.findByTestId("agent-type-badge");

    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));
    expect(await screen.findByText("Channels rejected: sms is not servable")).toBeInTheDocument();    expect(screen.getByText("Valid channels: voice, chat")).toBeInTheDocument();
  });

  it("renders 422 per-field errors as human-readable lines", async () => {
    mockMutateAsync.mockRejectedValueOnce(
      new ApiError("Unprocessable", 422, {
        errors: [
          { loc: ["body", "channels"], msg: "must not be empty" },
          { loc: ["body", "agent_type"], msg: "invalid type" },
        ],
      })
    );
    await renderConfigurePage();
    await screen.findByTestId("agent-type-badge");

    fireEvent.click(screen.getByRole("button", { name: /save configuration/i }));
    expect(await screen.findByText("channels: must not be empty")).toBeInTheDocument();
    expect(screen.getByText("agent_type: invalid type")).toBeInTheDocument();
  });
});
