import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FormProvider, useForm, useFormContext, useWatch } from "react-hook-form";
import { CatalogProviderField, CatalogVoiceField } from "@/components/settings/catalog-fields";
import { apiClient } from "@/lib/api-client";

jest.mock("@/lib/api-client", () => {
  const actual = jest.requireActual("@/lib/api-client");
  return { ...actual, apiClient: jest.fn() };
});

const mockedApiClient = apiClient as jest.Mock;

const LIBRARY_VOICE = {
  voice_id: "voice_1",
  agent_id: "agent-1",
  name: "Rachel",
  provider: "elevenlabs",
  provider_voice_id: "21m00Tcm4TlvDq8ikWAM",
  source: "provider",
  language: "en",
  created_at: "2026-09-03T00:00:00+00:00",
};

function renderVoiceField(props: {
  agentId?: string;
  provider?: string;
  model?: string;
}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function Host() {
    const methods = useForm({
      defaultValues: {
        agent_config: {
          synthesizer: {
            provider: props.provider ?? "elevenlabs",
            model: props.model ?? "eleven_turbo_v2_5",
            voice: "",
          },
        },
      },
    });
    return (
      <QueryClientProvider client={client}>
        <FormProvider {...methods}>
          <CatalogVoiceField
            name="agent_config.synthesizer.voice"
            label="Voice Name"
            modality="tts"
            providerField="agent_config.synthesizer.provider"
            modelField="agent_config.synthesizer.model"
            agentId={props.agentId}
            providerIdField="agent_config.synthesizer.provider"
            voiceIdTargetField="agent_config.synthesizer.voice_id"
          />
        </FormProvider>
      </QueryClientProvider>
    );
  }
  return render(<Host />);
}

describe("CatalogProviderField cascade", () => {
  const S2S_FALLBACK = [
    { label: "OpenAI Realtime", value: "openai_realtime" },
    { label: "Gemini Live", value: "gemini_live" },
  ];

  function renderCascade() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    function ModelProbe() {
      const { control } = useFormContext();
      const model = useWatch({ control, name: "agent_config.s2s.model" }) as string | undefined;
      return <span data-testid="model-probe">{model ?? "∅"}</span>;
    }
    function Host() {
      const methods = useForm({
        defaultValues: {
          agent_config: { s2s: { provider: "openai_realtime", model: "gpt-realtime-2.1-mini" } },
        },
      });
      return (
        <QueryClientProvider client={client}>
          <FormProvider {...methods}>
            <CatalogProviderField
              name="agent_config.s2s.provider"
              label="S2S Provider"
              modality="s2s"
              fallbackOptions={S2S_FALLBACK}
              resetFields={["agent_config.s2s.model", "agent_config.s2s.voice"]}
            />
            <ModelProbe />
          </FormProvider>
        </QueryClientProvider>
      );
    }
    return render(<Host />);
  }

  it("clears a stale cross-provider model when the provider changes", async () => {
    // The prod-log case: gemini_live provider with a gpt-realtime model 404s
    // the catalog and fails validation — the cascade clears it on selection.
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint === "/catalog/providers?modality=s2s") {
        return Promise.resolve([
          { provider: "openai_realtime", models: 3, deprecated: false },
          { provider: "gemini_live", models: 1, deprecated: false },
        ]);
      }
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
    renderCascade();
    expect(await screen.findByText(/Catalog · 2 providers/)).toBeInTheDocument();
    expect(screen.getByTestId("model-probe")).toHaveTextContent("gpt-realtime-2.1-mini");

    fireEvent.change(screen.getByLabelText("S2S Provider"), { target: { value: "gemini_live" } });

    await waitFor(() => expect(screen.getByTestId("model-probe")).toHaveTextContent("∅"));
  });
});

describe("CatalogVoiceField", () => {
  beforeEach(() => jest.clearAllMocks());

  it("unions the saved voice library when the catalog row has no curated voices", async () => {
    // ElevenLabs: voices_open with zero curated names (backend seed state).
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith("/catalog/voices")) return Promise.resolve([]);
      if (endpoint.startsWith("/voices")) return Promise.resolve({ voices: [LIBRARY_VOICE] });
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
    renderVoiceField({ agentId: "agent-1" });

    // findByRole retries until the queries settle and the select replaces
    // the initial free-text input.
    const select = (await screen.findByRole("combobox", { name: "Voice Name" })) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.text)).toContain("Rachel · library");
    expect(screen.getByText(/Voices · 0 catalog \+ 1 library/)).toBeInTheDocument();
  });

  it("renders catalog voices without a library when no agent is set", async () => {
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith("/catalog/voices")) {
        return Promise.resolve([{ name: "anushka", gender: null, language: "hi", sample_url: null }]);
      }
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
    renderVoiceField({});

    const select = (await screen.findByRole("combobox", { name: "Voice Name" })) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toContain("anushka");
    await waitFor(() => expect(mockedApiClient).not.toHaveBeenCalledWith(expect.stringMatching(/^\/voices/)));
  });

  it("sweeps the provider's model rows when no model is set", async () => {
    // The exact-row query needs provider+model; with model empty the field
    // unions voices across the provider's rows instead of collapsing to text.
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint === "/catalog/models?modality=tts&provider=sarvam") {
        return Promise.resolve([
          {
            catalog_id: "tts:sarvam:bulbul:v2",
            modality: "tts",
            provider: "sarvam",
            model: "bulbul:v2",
            languages: ["en", "hi"],
            models_open: false,
            deprecated: false,
          },
          {
            catalog_id: "tts:sarvam:bulbul:v3",
            modality: "tts",
            provider: "sarvam",
            model: "bulbul:v3",
            languages: ["en", "hi"],
            models_open: false,
            deprecated: false,
          },
        ]);
      }
      if (endpoint.startsWith("/catalog/voices")) {
        return Promise.resolve([
          { name: "anushka", gender: null, language: "hi", sample_url: null },
          { name: "abhilash", gender: null, language: "hi", sample_url: null },
        ]);
      }
      if (endpoint.startsWith("/voices")) return Promise.resolve({ voices: [] });
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
    renderVoiceField({ provider: "sarvam", model: "" });

    const select = (await screen.findByRole("combobox", { name: "Voice Name" })) as HTMLSelectElement;
    const values = Array.from(select.options).map((o) => o.value);
    expect(values).toContain("anushka");
    expect(values).toContain("abhilash");
    // Deduplicated across rows (placeholder + 2 unique voices).
    expect(values).toHaveLength(3);
  });

  it("falls back to free text when neither source knows a voice", async () => {
    mockedApiClient.mockImplementation((endpoint: string) => {
      if (endpoint.startsWith("/catalog/voices")) return Promise.resolve([]);
      if (endpoint.startsWith("/voices")) return Promise.resolve({ voices: [] });
      return Promise.reject(new Error(`unexpected ${endpoint}`));
    });
    renderVoiceField({ agentId: "agent-1" });

    await waitFor(() => expect(mockedApiClient).toHaveBeenCalled());
    expect(screen.getByLabelText("Voice Name").tagName).toBe("INPUT");
  });
});
