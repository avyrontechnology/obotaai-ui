import {
  toCreateAgentPayload,
  toFrontendAgent,
  toUpdateAgentPayload,
  templatePayloadToAgentData,
  stripNulls,
  defaultAsrModel,
  defaultTtsConfig,
  defaultLlmModel,
  defaultS2sModel,
  defaultChannels,
} from "@/services/api-transforms";
import { agentConfigSchema } from "@/lib/schemas/agent";
import type { AgentData } from "@/lib/schemas/agent";

describe("api-transforms", () => {
  describe("toCreateAgentPayload", () => {
    it("transforms voice agent data correctly", () => {
      const voiceAgentData: AgentData = {
        agent_name: "Test Voice Agent",
        agent_type: "voice",
        agent_prompts: {
          system_prompt: "You are a helpful voice assistant.",
          welcome_message: "Hello! How can I help?",
        },
        agent_config: {
          llm: {
            provider: "openai",
            model: "gpt-4o",
            max_tokens: 200,
            temperature: 0.3,
          },
          transcriber: {
            provider: "deepgram",
            model: "nova-2",
            language: "en",
            stream: true,
            encoding: "linear16",
            sampling_rate: 16000,
            endpointing: 400,
          },
          synthesizer: {
            provider: "elevenlabs",
            voice: "Rachel",
            voice_id: "21m00Tcm4TlvDq8ikWAM",
            model: "eleven_multilingual_v2",
            stream: true,
            buffer_size: 40,
            audio_format: "pcm",
            caching: true,
          },
        },
      };

      const payload = toCreateAgentPayload(voiceAgentData);

      expect(payload.agent_config.agent_name).toBe("Test Voice Agent");
      expect(payload.agent_config.agent_type).toBe("voice");
      expect(payload.agent_config.tasks).toHaveLength(1);
      expect(payload.agent_config.tasks[0].tools_config.llm_agent).toEqual(
        expect.objectContaining({
          model: "gpt-4o",
          provider: "openai",
          max_tokens: 200,
          temperature: 0.3,
        })
      );
      expect(payload.agent_config.tasks[0].tools_config.transcriber).toEqual(
        expect.objectContaining({
          provider: "deepgram",
          model: "nova-2",
          language: "en",
          stream: true,
        })
      );
      expect(payload.agent_config.tasks[0].tools_config.synthesizer).toEqual(
        expect.objectContaining({
          provider: "elevenlabs",
          stream: true,
        })
      );
      expect(payload.agent_config.tasks[0].toolchain.pipelines).toEqual([["transcriber", "llm", "synthesizer"]]);
      expect(payload.agent_prompts).toEqual({
        task_1: {
          system_prompt: "You are a helpful voice assistant.",
        },
      });
    });
  });

  describe("phase 3 mappings", () => {
    const baseData: AgentData = {
      agent_name: "Phase3 Agent",
      agent_type: "voice",
      agent_prompts: { system_prompt: "You are a helpful assistant." },
      agent_config: {},
    };

    it("maps DTMF, call limits and cancel prompt into task_config", () => {
      const payload = toCreateAgentPayload({
        ...baseData,
        agent_config: {
          conversation: {
            dtmf_enabled: true,
            call_terminate: 300,
            hangup_after_LLMCall: true,
            call_cancellation_prompt: "Cancel my order",
            backchanneling_message_gap: 8,
            backchanneling_start_delay: 6,
          },
        },
      });
      expect(payload.agent_config.tasks[0].task_config).toEqual(
        expect.objectContaining({
          dtmf_enabled: true,
          call_terminate: 300,
          hangup_after_LLMCall: true,
          call_cancellation_prompt: "Cancel my order",
          backchanneling_message_gap: 8,
          backchanneling_start_delay: 6,
        })
      );
    });

    it("maps opt-in telephony providers into input/output", () => {
      const payload = toCreateAgentPayload({
        ...baseData,
        agent_config: { telephony: { input_provider: "twilio", output_provider: "twilio" } },
      });
      expect(payload.agent_config.tasks[0].tools_config.input).toEqual(
        expect.objectContaining({ provider: "twilio" })
      );
      expect(payload.agent_config.tasks[0].tools_config.output).toEqual(
        expect.objectContaining({ provider: "twilio" })
      );
    });

    it("omits input/output when telephony is not configured", () => {
      const payload = toCreateAgentPayload(baseData);
      expect(payload.agent_config.tasks[0].tools_config.input).toBeUndefined();
      expect(payload.agent_config.tasks[0].tools_config.output).toBeUndefined();
    });

    it("maps persona multilingual prompts into agent_prompts", () => {
      const payload = toCreateAgentPayload({
        ...baseData,
        agent_config: {
          persona: {
            system_prompt: "You are helpful.",
            welcome_message: "Hello!",
            languages: ["hi"],
            multilingual_prompts: { hi: { system_prompt: "Aap sahayak hain." } },
          },
        },
      });
      expect(payload.agent_prompts).toEqual({
        task_1: {
          system_prompt: "You are helpful.",
          multilingual_prompts: { hi: { system_prompt: "Aap sahayak hain." } },
        },
      });
      expect(payload.agent_config.agent_welcome_message).toBe("Hello!");
    });

    it("emits an s2s pipeline for s2s agents", () => {
      const payload = toCreateAgentPayload({
        ...baseData,
        agent_type: "s2s",
        agent_config: {
          s2s: { provider: "openai_realtime", model: "gpt-realtime-2.1", voice: "marin" },
        },
      });
      const task = payload.agent_config.tasks[0];
      expect(task.toolchain.pipelines).toEqual([["s2s"]]);
      expect(task.tools_config.s2s).toEqual(
        expect.objectContaining({ provider: "openai_realtime" })
      );
      expect(task.tools_config.transcriber).toBeUndefined();
      expect(task.tools_config.synthesizer).toBeUndefined();
    });

    it("parses persona and s2s back in toFrontendAgent", () => {
      const agent = toFrontendAgent({
        agent_id: "agent-s2s",
        data: {
          agent_name: "S2S Agent",
          agent_type: "s2s",
          agent_welcome_message: "Hey!",
          tasks: [
            {
              tools_config: {
                s2s: { provider: "gemini_live", provider_config: { voice: "Kore" } },
                llm_agent: { provider: "openai", model: "gpt-4o" },
              },
              toolchain: { execution: "parallel", pipelines: [["s2s"]] },
              task_config: { dtmf_enabled: true },
            },
          ],
        },
        agent_prompts: {
          task_1: {
            system_prompt: "Be brief.",
            multilingual_prompts: { hi: { system_prompt: "Sankshep mein." } },
          },
        },
      });
      expect(agent.agent_config.s2s?.provider).toBe("gemini_live");
      expect(agent.agent_config.s2s?.voice).toBe("Kore");
      expect(agent.agent_config.conversation?.dtmf_enabled).toBe(true);
      expect(agent.agent_config.persona?.system_prompt).toBe("Be brief.");
      expect(agent.agent_config.persona?.languages).toEqual(["hi"]);
    });
  });

    it("transforms text-only agent data correctly", () => {
      const textAgentData: AgentData = {
        agent_name: "Test Text Agent",
        agent_type: "text",
        agent_prompts: {
          system_prompt: "You are a helpful text assistant.",
        },
        agent_config: {
          llm: {
            provider: "anthropic",
            model: "claude-3.5-sonnet",
            temperature: 0.5,
          },
        },
      };

      const payload = toCreateAgentPayload(textAgentData);

      expect(payload.agent_config.agent_name).toBe("Test Text Agent");
      expect(payload.agent_config.agent_type).toBe("text");
      expect(payload.agent_config.tasks[0].tools_config.transcriber).toBeUndefined();
      expect(payload.agent_config.tasks[0].tools_config.synthesizer).toBeUndefined();
      expect(payload.agent_config.tasks[0].toolchain.pipelines).toEqual([["llm"]]);
    });

    it("uses default values when optional fields are missing", () => {
      const minimalData: AgentData = {
        agent_name: "Minimal Agent",
        agent_type: "voice",
        agent_prompts: {
          system_prompt: "You are a helpful assistant.",
        },
        agent_config: {},
      };

      const payload = toCreateAgentPayload(minimalData);

      expect(payload.agent_config.tasks[0].tools_config.llm_agent).toEqual(
        expect.objectContaining({
          model: "gpt-4o",
          provider: "openai",
          max_tokens: 150,
          temperature: 0.2,
        })
      );
      expect(payload.agent_config.tasks[0].tools_config.transcriber).toEqual(
        expect.objectContaining({
          provider: "deepgram",
          model: "nova-2",
        })
      );
    });

  describe("toFrontendAgent", () => {
    it("transforms nested backend response (GET /all) correctly", () => {
      const backendResponse = {
        agent_id: "agent-123",
        data: {
          agent_name: "Backend Agent",
          agent_type: "voice",
          agent_welcome_message: "Welcome!",
          tasks: [
            {
              tools_config: {
                llm_agent: {
                  provider: "openai",
                  model: "gpt-4o",
                  max_tokens: 150,
                  temperature: 0.2,
                },
                transcriber: {
                  provider: "deepgram",
                  model: "nova-2",
                },
                synthesizer: {
                  provider: "elevenlabs",
                  stream: true,
                  provider_config: {
                    voice: "Rachel",
                    voice_id: "21m00Tcm4TlvDq8ikWAM",
                  },
                },
              },
              toolchain: {
                execution: "parallel",
                pipelines: [["transcriber", "llm", "synthesizer"]],
              },
              task_config: {
                optimize_latency: true,
                hangup_after_silence: 10000,
              },
            },
          ],
        },
        agent_prompts: {
          task_1: {
            system_prompt: "You are a helpful assistant.",
          },
        },
      };

      const agent = toFrontendAgent(backendResponse);

      expect(agent.agent_id).toBe("agent-123");
      expect(agent.agent_name).toBe("Backend Agent");
      expect(agent.agent_type).toBe("voice");
      expect(agent.agent_prompts.system_prompt).toBe("You are a helpful assistant.");
      expect(agent.agent_prompts.welcome_message).toBe("Welcome!");
      expect(agent.agent_config.llm).toEqual(
        expect.objectContaining({
          provider: "openai",
          model: "gpt-4o",
        })
      );
      expect(agent.agent_config.transcriber).toEqual(
        expect.objectContaining({
          provider: "deepgram",
        })
      );
      expect(agent.agent_config.synthesizer).toEqual(
        expect.objectContaining({
          provider: "elevenlabs",
          voice: "Rachel",
        })
      );
      expect(agent.agent_config.conversation).toEqual(
        expect.objectContaining({
          optimize_latency: true,
          hangup_after_silence: 10000,
        })
      );
    });

    it("transforms flat backend response correctly", () => {
      const flatResponse = {
        agent_id: "agent-456",
        agent_name: "Flat Agent",
        agent_type: "text",
        agent_prompts: {
          task_1: {
            system_prompt: "You are a text assistant.",
          },
        },
      };

      const agent = toFrontendAgent(flatResponse);

      expect(agent.agent_id).toBe("agent-456");
      expect(agent.agent_name).toBe("Flat Agent");
      expect(agent.agent_type).toBe("text");
      expect(agent.agent_prompts.system_prompt).toBe("You are a text assistant.");
    });

    it("handles missing/undefined fields gracefully", () => {
      const emptyResponse = {
        agent_id: "agent-789",
      };

      const agent = toFrontendAgent(emptyResponse);

      expect(agent.agent_id).toBe("agent-789");
      expect(agent.agent_name).toBe("Unnamed Agent");
      expect(agent.agent_type).toBe("other");
      expect(agent.agent_prompts.system_prompt).toBeUndefined();
    });
  });

  describe("templatePayloadToAgentData", () => {
    const templatePayload = {
      agent_name: "COD Confirmation Agent",
      agent_type: "voice",
      tasks: [
        {
          task_type: "conversation",
          toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]] },
          tools_config: {
            input: { format: "wav", provider: "simulated" },
            output: { format: "wav", provider: "simulated" },
            transcriber: { provider: "deepgram", language: "hi", stream: true },
            llm_agent: { provider: "openai", model: "gpt-4o-mini" },
            synthesizer: {
              provider: "elevenlabs",
              stream: true,
              audio_format: "wav",
              provider_config: { voice: "Rachel", voice_id: "voice123", model: "eleven_turbo_v2_5" },
            },
          },
          task_config: { check_if_user_online: true },
        },
      ],
      agent_prompts: { system_prompt: "Confirm COD orders.", welcome_message: "Hello!" },
    };

    it("converts a template payload into flat agent data", () => {
      const data = templatePayloadToAgentData(templatePayload);
      expect(data.agent_name).toBe("COD Confirmation Agent");
      expect(data.agent_type).toBe("voice");
      expect(data.agent_config.transcriber?.provider).toBe("deepgram");
      expect(data.agent_config.transcriber?.language).toBe("hi");
      expect(data.agent_config.llm?.model).toBe("gpt-4o-mini");
      expect(data.agent_config.synthesizer?.voice_id).toBe("voice123");
      expect(data.agent_config.conversation?.check_if_user_online).toBe(true);
      expect(data.agent_prompts.system_prompt).toBe("Confirm COD orders.");
      expect(data.agent_prompts.welcome_message).toBe("Hello!");
    });

    it("round-trips back into a valid create payload", () => {
      const payload = toCreateAgentPayload(templatePayloadToAgentData(templatePayload));
      expect(payload.agent_config.tasks).toHaveLength(1);
      expect(payload.agent_config.tasks[0].tools_config.transcriber).toEqual(
        expect.objectContaining({ provider: "deepgram" })
      );
    });
  });

  describe("update round-trip (configure save)", () => {
    // Regression: the configure form submits AgentData whose agent_config
    // carries the edited values unwrapped. The payload must contain the
    // edits — never silently fall back to defaults (backend 200s either way).
    it("carries edited prompts and pipeline fields into the PUT payload", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Edited Agent",
        agent_type: "voice",
        agent_prompts: {
          system_prompt: "You are a support agent for Acme.",
          welcome_message: "Welcome to Acme!",
        },
        agent_config: {
          persona: {
            system_prompt: "You are a support agent for Acme.",
            welcome_message: "Welcome to Acme!",
          },
          transcriber: { provider: "deepgram", model: "nova-3" },
          llm: { provider: "openai", model: "gpt-4o-mini", request_json: true },
          synthesizer: { provider: "elevenlabs", style: 0.5, language: "en" },
          telephony: { input_provider: "twilio", input_format: "wav" },
        },
      });

      expect(payload.agent_prompts).toEqual({
        task_1: { system_prompt: "You are a support agent for Acme." },
      });
      expect(payload.agent_config.agent_welcome_message).toBe("Welcome to Acme!");
      const tools = payload.agent_config.tasks[0].tools_config;
      expect(tools.transcriber).toEqual(expect.objectContaining({ model: "nova-3" }));
      expect(tools.llm_agent).toEqual(
        expect.objectContaining({ model: "gpt-4o-mini", request_json: true })
      );
      expect(tools.synthesizer).toEqual(
        expect.objectContaining({ provider_config: expect.objectContaining({ style: 0.5, language: "en" }) })
      );
      expect(tools.input).toEqual(expect.objectContaining({ provider: "twilio" }));
    });

    it("parses telephony, request_json and synth extras back on load", () => {
      const agent = toFrontendAgent({
        agent_id: "agent-rt",
        data: {
          agent_name: "RT Agent",
          agent_type: "voice",
          agent_welcome_message: "Hi",
          tasks: [
            {
              tools_config: {
                input: { provider: "twilio", format: "wav" },
                output: { provider: "twilio", format: "wav" },
                llm_agent: { provider: "openai", model: "gpt-4o", request_json: true },
                transcriber: { provider: "deepgram" },
                synthesizer: {
                  provider: "elevenlabs",
                  provider_config: { voice: "Rachel", style: 0.4, top_p: 0.9 },
                },
              },
              toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]] },
              task_config: {},
            },
          ],
        },
        agent_prompts: { task_1: { system_prompt: "Be helpful." } },
      });

      expect(agent.agent_config.telephony).toEqual(
        expect.objectContaining({ input_provider: "twilio", output_provider: "twilio" })
      );
      expect(agent.agent_config.llm?.request_json).toBe(true);
      expect(agent.agent_config.synthesizer).toEqual(
        expect.objectContaining({ style: 0.4, top_p: 0.9 })
      );
    });

    it("normalizes the backend 'default' telephony provider back to unset", () => {
      const agent = toFrontendAgent({
        agent_id: "agent-txt",
        data: {
          agent_name: "Text Agent",
          agent_type: "text",
          tasks: [
            {
              tools_config: {
                input: { provider: "default", format: "wav" },
                output: { provider: "default", format: "wav" },
                llm_agent: { provider: "openai", model: "gpt-4o" },
              },
              toolchain: { execution: "parallel", pipelines: [["llm"]] },
              task_config: {},
            },
          ],
        },
        agent_prompts: { task_1: { system_prompt: "Be helpful." } },
      });

      expect(agent.agent_config.telephony?.input_provider).toBeUndefined();
      expect(agent.agent_config.telephony?.output_provider).toBeUndefined();
    });
  });

  describe("s2s full record (backend-verified shape)", () => {
    // Mirrors a real GET /agent/:id record for an s2s agent: top-level tasks,
    // null provider slots, full provider_config, no agent_prompts.
    const s2sRecord = {
      agent_name: "Customer Support Agent",
      agent_type: "s2s",
      tasks: [
        {
          tools_config: {
            llm_agent: null,
            synthesizer: null,
            transcriber: null,
            input: null,
            output: null,
            api_tools: null,
            s2s: {
              provider: "openai_realtime",
              provider_config: {
                model: "gpt-realtime-2.1",
                voice: "marin",
                speed: 1.0,
                turn_detection_type: "semantic_vad",
                eagerness: "auto",
                vad_threshold: 0.5,
                vad_silence_duration_ms: 500,
                vad_prefix_padding_ms: 300,
                reasoning_effort: null,
                max_output_tokens: null,
                transcription_model: "gpt-4o-mini-transcribe",
                language: null,
              },
              welcome_audio_gate_ms: 1500,
            },
          },
          toolchain: { execution: "parallel", pipelines: [["s2s"]] },
          task_type: "conversation",
          task_config: { optimize_latency: true, hangup_after_silence: 20 },
        },
      ],
      agent_welcome_message: "Hello! Thanks for calling support.",
      assistant_status: "updated",
    };

    it("parses every s2s provider field on load", () => {
      const agent = toFrontendAgent({ ...s2sRecord, agent_id: "agent-s2s-1" });
      expect(agent.agent_id).toBe("agent-s2s-1");
      expect(agent.agent_config.s2s).toEqual(
        expect.objectContaining({
          provider: "openai_realtime",
          model: "gpt-realtime-2.1",
          voice: "marin",
          speed: 1.0,
          turn_detection_type: "semantic_vad",
          eagerness: "auto",
          vad_threshold: 0.5,
          vad_silence_duration_ms: 500,
          vad_prefix_padding_ms: 300,
          transcription_model: "gpt-4o-mini-transcribe",
        })
      );
      expect(agent.agent_config.s2s?.welcome_audio_gate_ms).toBe(1500);
      expect(agent.agent_prompts.welcome_message).toBe("Hello! Thanks for calling support.");
    });

    it("writes the s2s provider fields back on save", () => {
      const agent = toFrontendAgent({ ...s2sRecord, agent_id: "agent-s2s-1" });
      const payload = toCreateAgentPayload({
        agent_name: agent.agent_name,
        agent_type: agent.agent_type,
        agent_prompts: { system_prompt: "You are support." },
        agent_config: agent.agent_config,
      });
      const s2s = payload.agent_config.tasks[0].tools_config.s2s as {
        provider: string;
        provider_config: Record<string, unknown>;
        welcome_audio_gate_ms?: number;
      };
      expect(s2s.provider).toBe("openai_realtime");
      expect(s2s.provider_config).toEqual(
        expect.objectContaining({
          model: "gpt-realtime-2.1",
          voice: "marin",
          speed: 1.0,
          vad_threshold: 0.5,
          vad_prefix_padding_ms: 300,
          transcription_model: "gpt-4o-mini-transcribe",
        })
      );
      expect(s2s.welcome_audio_gate_ms).toBe(1500);
      expect(payload.agent_config.tasks[0].toolchain.pipelines).toEqual([["s2s"]]);
    });

    it("round-trips llm extras without UI controls", () => {
      const agent = toFrontendAgent({
        agent_id: "agent-llm-x",
        data: {
          agent_name: "X",
          agent_type: "voice",
          tasks: [
            {
              tools_config: {
                llm_agent: {
                  provider: "openai",
                  model: "gpt-4o",
                  base_url: "https://proxy.example.com/v1",
                  stop: ["###"],
                },
                transcriber: { provider: "deepgram" },
                synthesizer: { provider: "elevenlabs", provider_config: {} },
              },
              toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]] },
              task_config: {},
            },
          ],
        },
      });
      expect(agent.agent_config.llm?.base_url).toBe("https://proxy.example.com/v1");
      const payload = toCreateAgentPayload({
        agent_name: "X",
        agent_type: "voice",
        agent_prompts: { system_prompt: "Hi." },
        agent_config: agent.agent_config,
      });
      expect(payload.agent_config.tasks[0].tools_config.llm_agent).toEqual(
        expect.objectContaining({ base_url: "https://proxy.example.com/v1", stop: ["###"] })
      );
    });
  });

  describe("backend null handling", () => {
    // Mirrors a real GET /agent/:id record: the backend persists explicit
    // nulls for every unset Optional field.
    const nullLaden = {
      agent_id: "agent-nulls",
      agent_name: "Null Agent",
      agent_type: "voice",
      agent_welcome_message: "Hi",
      tasks: [
        {
          tools_config: {
            transcriber: { provider: "deepgram", model: null, language: "en", stream: null },
            llm_agent: { provider: "openai", model: "gpt-4o", reasoning_effort: null, base_url: null },
            synthesizer: {
              provider: "elevenlabs",
              stream: true,
              provider_config: { voice: "Rachel", voice_id: null, temperature: null },
            },
          },
          toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]] },
          task_config: {
            optimize_latency: true,
            call_cancellation_prompt: null,
            check_user_online_message: null,
          },
        },
      ],
      agent_prompts: { task_1: { system_prompt: "Be helpful." } },
    };

    it("strips nulls so the settings schema validates", () => {
      const agent = toFrontendAgent(nullLaden);
      expect(JSON.stringify(agent.agent_config)).not.toContain(":null");
      expect(agentConfigSchema.safeParse(agent.agent_config).success).toBe(true);
    });

    it("keeps falsy-but-valid values", () => {
      const agent = toFrontendAgent({
        ...nullLaden,
        tasks: [
          {
            ...nullLaden.tasks[0],
            task_config: { optimize_latency: false, hangup_after_silence: 0 },
          },
        ],
      });
      expect(agent.agent_config.conversation?.optimize_latency).toBe(false);
      expect(agent.agent_config.conversation?.hangup_after_silence).toBe(0);
    });

    it("stripNulls preserves arrays and drops only nullish entries", () => {
      expect(stripNulls({ a: null, b: undefined, c: 0, d: "", e: false, f: [null, 1] })).toEqual({
        c: 0,
        d: "",
        e: false,
        f: [null, 1],
      });
    });
  });

  describe("catalog-valid create defaults (spec 0022)", () => {
    // Closed catalog rows must match exactly; these defaults mirror
    // voiceai/modules/catalog/seed.py so provider-only picks (the wizard
    // toolchain step) produce payloads that pass write-time validation.
    // Explicit form values always win — see the last test.
    it.each([
      ["deepgram", "nova-2"],
      ["sarvam", "saaras:v4"],
      ["pixa", "pixa-1"],
      ["assembly", "nova-2"],
      ["openai", "nova-2"],
    ])("defaults the ASR model for %s", (provider, model) => {
      expect(defaultAsrModel(provider)).toBe(model);
    });

    it.each([
      ["elevenlabs", "eleven_turbo_v2_5", "Rachel"],
      ["sarvam", "bulbul:v2", "anushka"],
      ["maya", "Maya 2 Native", "Ananya"],
      ["kalpa", "kalpa-tts-multilingual-beta-v0.1", "Kiara"],
      ["polly", "neural", "Rachel"],
      ["deepgram", "aura-zeus-en", "Rachel"],
      ["pixa", "luna-tts", "Rachel"],
    ])("defaults the TTS model/voice for %s", (provider, model, voice) => {
      expect(defaultTtsConfig(provider)).toEqual({ model, voice });
    });

    it.each([
      ["openai", "gpt-4o"],
      ["google", "gemini-3.6-flash"],
      ["groq", "gpt-4o"],
    ])("defaults the LLM model for %s", (provider, model) => {
      expect(defaultLlmModel(provider)).toBe(model);
    });

    it.each([
      ["openai_realtime", "gpt-realtime-2.1"],
      ["gemini_live", "gemini-3.1-flash-live-preview"],
    ])("defaults the S2S model for %s", (provider, model) => {
      expect(defaultS2sModel(provider)).toBe(model);
    });

    it("fills a sarvam-only wizard pick with a validating payload", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Sarvam Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: { llm_provider: "openai", asr_provider: "sarvam", tts_provider: "sarvam" },
      });
      const tools = payload.agent_config.tasks[0].tools_config;
      expect(tools.transcriber).toEqual(expect.objectContaining({ provider: "sarvam", model: "saaras:v4" }));
      expect(tools.synthesizer).toEqual(
        expect.objectContaining({
          provider: "sarvam",
          provider_config: expect.objectContaining({ model: "bulbul:v2", voice: "anushka" }),
        })
      );
    });

    it("fills a missing S2S model per provider instead of 400ing", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Realtime Agent",
        agent_type: "s2s",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: { s2s: { provider: "openai_realtime" } },
      });
      expect(payload.agent_config.tasks[0].tools_config.s2s).toEqual(
        expect.objectContaining({
          provider: "openai_realtime",
          provider_config: expect.objectContaining({ model: "gpt-realtime-2.1" }),
        })
      );
    });

    it("emits channels per form type and never an empty array (specs 0028 + 0038)", () => {
      const base = {
        agent_name: "Agent",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: {},
      } as const;
      expect(defaultChannels({ ...base, agent_type: "voice" })).toEqual(["voice"]);
      expect(defaultChannels({ ...base, agent_type: "s2s" })).toEqual(["voice"]);
      // Text agents serve the HTTP chat runtime (Phase C allowlist).
      expect(defaultChannels({ ...base, agent_type: "text" })).toEqual(["chat"]);
      expect(defaultChannels({ ...base, agent_type: "other" })).toBeUndefined();
      // Explicit non-empty channels win (deduped); empties fall back.
      expect(
        defaultChannels({ ...base, agent_type: "voice", channels: ["voice", "voice"] })
      ).toEqual(["voice"]);
      expect(defaultChannels({ ...base, agent_type: "voice", channels: [] })).toEqual(["voice"]);

      const payload = toCreateAgentPayload({ ...base, agent_type: "voice" });
      expect(payload.agent_config.channels).toEqual(["voice"]);
      const textPayload = toCreateAgentPayload({ ...base, agent_type: "text" });
      expect(textPayload.agent_config.channels).toEqual(["chat"]);
    });

    it("round-trips channels through toFrontendAgent (absent stays absent)", () => {
      const withChannels = toFrontendAgent({
        agent_id: "a1",
        data: { agent_name: "A", agent_type: "voice", tasks: [], channels: ["voice"] },
      });
      expect(withChannels.channels).toEqual(["voice"]);
      const legacy = toFrontendAgent({
        agent_id: "a2",
        data: { agent_name: "B", agent_type: "voice", tasks: [] },
      });
      expect(legacy.channels).toBeUndefined();
    });

    it("emits both blocks plus an explicit pointer when the toggle is set (spec 0028)", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Dual Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: {
          pipeline: "s2s",
          transcriber: { provider: "deepgram", model: "nova-2" },
          synthesizer: { provider: "elevenlabs", voice: "Rachel", model: "eleven_turbo_v2_5" },
          llm: { provider: "openai", model: "gpt-4o" },
          s2s: { provider: "openai_realtime", model: "gpt-realtime-2.1" },
        },
      });
      const task = payload.agent_config.tasks[0];
      expect(task.pipeline).toBe("s2s");
      expect(task.tools_config.s2s).toEqual(expect.objectContaining({ provider: "openai_realtime" }));
      expect(task.tools_config.transcriber).toEqual(expect.objectContaining({ provider: "deepgram" }));
      expect(task.tools_config.synthesizer).toEqual(expect.objectContaining({ provider: "elevenlabs" }));
      expect(task.tools_config.llm_agent).toEqual(expect.objectContaining({ provider: "openai" }));
      // Active pipeline first, parked second.
      expect(task.toolchain.pipelines).toEqual([
        ["s2s"],
        ["transcriber", "llm", "synthesizer"],
      ]);
    });

    it("omits the pointer and keeps legacy single-pipeline shape when untouched", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Voice Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: {
          transcriber: { provider: "deepgram", model: "nova-2" },
          synthesizer: { provider: "elevenlabs", voice: "Rachel", model: "eleven_turbo_v2_5" },
          llm: { provider: "openai", model: "gpt-4o" },
        },
      });
      const task = payload.agent_config.tasks[0];
      expect("pipeline" in task).toBe(false);
      expect(task.tools_config.s2s).toBeUndefined();
      expect(task.toolchain.pipelines).toEqual([["transcriber", "llm", "synthesizer"]]);
    });

    it("ignores the pointer on text agents (toggle is voice/s2s only)", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Text Agent",
        agent_type: "text",
        agent_prompts: { system_prompt: "You are a helpful assistant." },
        agent_config: { pipeline: "s2s", llm: { provider: "openai", model: "gpt-4o" } },
      });
      const task = payload.agent_config.tasks[0];
      expect("pipeline" in task).toBe(false);
      expect(task.tools_config.s2s).toBeUndefined();
      expect(task.tools_config.transcriber).toBeUndefined();
    });

    it("reads the stored pointer back for the toggle", () => {
      const agent = toFrontendAgent({
        agent_id: "a1",
        data: {
          agent_name: "A",
          agent_type: "voice",
          tasks: [{ pipeline: "s2s", tools_config: {} }],
        },
      });
      expect(agent.agent_config.pipeline).toBe("s2s");
      const legacy = toFrontendAgent({
        agent_id: "a2",
        data: { agent_name: "B", agent_type: "voice", tasks: [{ tools_config: {} }] },
      });
      expect(legacy.agent_config.pipeline).toBeUndefined();
    });

    it("emits api_tools only when the form carries attachments (spec 0029)", () => {
      const base = {
        agent_name: "Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: {},
      } as const;
      // Untouched agents keep legacy payloads byte-identical.
      expect("api_tools" in toCreateAgentPayload({ ...base }).agent_config.tasks[0].tools_config).toBe(false);

      const payload = toCreateAgentPayload({
        ...base,
        agent_config: {
          api_tools: {
            tool_refs: ["function:calendar"],
            webhooks: { notify: { ref: "webhook:pre_call_notify", param: { event: "x" } } },
            embedded_params: { legacy: { url: "https://old.test/x" } },
          },
        },
      });
      const apiTools = payload.agent_config.tasks[0].tools_config.api_tools as Record<string, unknown>;
      expect(apiTools.tool_refs).toEqual(["function:calendar"]);
      // tools: [] is load-bearing — materialization appends into the list.
      expect(apiTools.tools).toEqual([]);
      expect(apiTools.tools_params).toEqual({
        legacy: { url: "https://old.test/x" },
        notify: { pre_call_webhook_ref: "webhook:pre_call_notify", pre_call_webhook_param: { event: "x" } },
      });
    });

    it("round-trips attachments and preserves embedded entries", () => {
      const agent = toFrontendAgent({
        agent_id: "a1",
        data: {
          agent_name: "A",
          agent_type: "voice",
          tasks: [
            {
              tools_config: {
                api_tools: {
                  tool_refs: ["function:calendar"],
                  tools: [{ type: "function", function: { name: "legacy_fn" } }],
                  tools_params: {
                    notify: { pre_call_webhook_ref: "webhook:pre_call_notify", pre_call_webhook_param: { event: "y" } },
                    legacy: { url: "https://old.test/x" },
                  },
                },
              },
            },
          ],
        },
      });
      expect(agent.agent_config.api_tools?.tool_refs).toEqual(["function:calendar"]);
      expect(agent.agent_config.api_tools?.webhooks).toEqual({
        notify: { ref: "webhook:pre_call_notify", param: { event: "y" } },
      });
      expect(agent.agent_config.api_tools?.embedded_params).toEqual({ legacy: { url: "https://old.test/x" } });
      expect(agent.agent_config.api_tools?.embedded_tools).toHaveLength(1);

      // Re-emission preserves everything (PUT round-trip safety).
      const repayload = toCreateAgentPayload({
        agent_name: "A",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: agent.agent_config,
      });
      const reemitted = repayload.agent_config.tasks[0].tools_config.api_tools as Record<string, unknown>;
      expect(reemitted.tool_refs).toEqual(["function:calendar"]);
      expect(reemitted.tools_params).toEqual(
        expect.objectContaining({ legacy: { url: "https://old.test/x" } })
      );
    });

    it("never overrides explicit model/voice values", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Custom Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: {
          transcriber: { provider: "sarvam", model: "saaras:v3" },
          synthesizer: { provider: "sarvam", voice: "vidya", model: "bulbul:v3" },
          llm: { provider: "openai", model: "gpt-4o-mini" },
        },
      });
      const tools = payload.agent_config.tasks[0].tools_config;
      expect(tools.transcriber).toEqual(expect.objectContaining({ model: "saaras:v3" }));
      expect(tools.synthesizer).toEqual(
        expect.objectContaining({
          provider_config: expect.objectContaining({ model: "bulbul:v3", voice: "vidya" }),
        })
      );
    });
  });

  describe("phase C forward-compat (chat pointer)", () => {
    const baseData: AgentData = {
      agent_name: "Chat Agent",
      agent_type: "text",
      agent_prompts: { system_prompt: "You are a helpful assistant." },
      agent_config: { llm: { provider: "openai", model: "gpt-4o" } },
    };

    it("accepts a stored chat pointer in the form schema", () => {
      expect(agentConfigSchema.safeParse({ pipeline: "chat" }).success).toBe(true);
      expect(agentConfigSchema.safeParse({ pipeline: "smoke" }).success).toBe(false);
    });

    it("re-emits a stored chat pointer verbatim without forcing blocks", () => {
      const payload = toCreateAgentPayload({
        ...baseData,
        agent_config: { ...baseData.agent_config, pipeline: "chat" },
      });
      const task = payload.agent_config.tasks[0];
      expect(task.pipeline).toBe("chat");
      // Text shape untouched: llm-only tools, single toolchain pipeline.
      expect(task.tools_config.transcriber).toBeUndefined();
      expect(task.tools_config.s2s).toBeUndefined();
      expect(task.toolchain.pipelines).toEqual([["llm"]]);
    });

    it("passes a chat pointer through on text forms without forcing blocks", () => {
      const payload = toCreateAgentPayload({
        ...baseData,
        agent_config: { ...baseData.agent_config, pipeline: "chat" },
      });
      const task = payload.agent_config.tasks[0];
      expect(task.pipeline).toBe("chat");
      expect(task.tools_config.transcriber).toBeUndefined();
      expect(task.tools_config.s2s).toBeUndefined();
      expect(task.tools_config.llm_agent).toEqual(expect.objectContaining({ model: "gpt-4o" }));
    });

    it("reads a chat pointer back for round-trip preservation", () => {
      const agent = toFrontendAgent({
        agent_id: "a1",
        data: {
          agent_name: "Chat Agent",
          agent_type: "text",
          tasks: [{ pipeline: "chat", tools_config: { llm_agent: { provider: "openai", model: "gpt-4o" } } }],
        },
      });
      expect(agent.agent_config.pipeline).toBe("chat");
    });
  });

  describe("hybrid channels ∪ agent_type emission", () => {
    const hybridBlocks = {
      llm: { provider: "openai", model: "gpt-4o" },
      transcriber: { provider: "deepgram", model: "nova-2" },
      synthesizer: { provider: "elevenlabs", voice: "Rachel", model: "eleven_turbo_v2_5" },
      s2s: { provider: "openai_realtime", model: "gpt-realtime-2.1" },
    } as const;

    it("defaultChannels: explicit non-empty channels always win verbatim", () => {
      const base = {
        agent_name: "Agent",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: {},
      } as const;
      // Including the full hybrid pair, on every type.
      expect(defaultChannels({ ...base, agent_type: "voice", channels: ["voice", "chat"] })).toEqual([
        "voice",
        "chat",
      ]);
      expect(defaultChannels({ ...base, agent_type: "text", channels: ["voice", "chat"] })).toEqual([
        "voice",
        "chat",
      ]);
      expect(defaultChannels({ ...base, agent_type: "s2s", channels: ["voice", "chat"] })).toEqual([
        "voice",
        "chat",
      ]);
      // Order-preserving dedup.
      expect(
        defaultChannels({ ...base, agent_type: "text", channels: ["chat", "voice", "chat"] })
      ).toEqual(["chat", "voice"]);
      // Empty entries are filtered; all-empty falls back to the type default.
      expect(defaultChannels({ ...base, agent_type: "voice", channels: ["", "voice"] })).toEqual([
        "voice",
      ]);
      expect(defaultChannels({ ...base, agent_type: "voice", channels: [""] })).toEqual(["voice"]);
      expect(defaultChannels({ ...base, agent_type: "other", channels: [""] })).toBeUndefined();
      // Never emits [].
      for (const t of ["voice", "text", "s2s", "other"] as const) {
        const out = defaultChannels({ ...base, agent_type: t, channels: [] });
        if (out !== undefined) expect(out.length).toBeGreaterThan(0);
      }
    });

    it("emits voice blocks for text agents carrying a voice channel", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Hybrid Text Agent",
        agent_type: "text",
        agent_prompts: { system_prompt: "You are a helpful assistant." },
        channels: ["voice", "chat"],
        agent_config: { llm: { provider: "openai", model: "gpt-4o" } },
      });
      const task = payload.agent_config.tasks[0];
      expect(payload.agent_config.channels).toEqual(["voice", "chat"]);
      expect(task.tools_config.transcriber).toEqual(expect.objectContaining({ provider: "deepgram" }));
      expect(task.tools_config.synthesizer).toEqual(expect.objectContaining({ provider: "elevenlabs" }));
      expect(task.tools_config.llm_agent).toEqual(expect.objectContaining({ model: "gpt-4o" }));
      expect(task.tools_config.s2s).toBeUndefined();
      expect(task.toolchain.pipelines).toEqual([["transcriber", "llm", "synthesizer"]]);
      expect("pipeline" in task).toBe(false);
    });

    it("keeps voice-only shape for voice agents with both channels and no toggle", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Hybrid Voice Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        channels: ["voice", "chat"],
        agent_config: { llm: { provider: "openai", model: "gpt-4o" } },
      });
      const task = payload.agent_config.tasks[0];
      expect(payload.agent_config.channels).toEqual(["voice", "chat"]);
      expect(task.tools_config.transcriber).toBeDefined();
      expect(task.tools_config.s2s).toBeUndefined();
      expect(task.toolchain.pipelines).toEqual([["transcriber", "llm", "synthesizer"]]);
      expect("pipeline" in task).toBe(false);
    });

    it("flipping voice→text keeps parked blocks while a voice channel is retained", () => {
      const voiceForm: AgentData = {
        agent_name: "Hybrid Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        channels: ["voice", "chat"],
        agent_config: { pipeline: "s2s", ...hybridBlocks },
      };
      // Sanity: the voice form carries both blocks.
      const before = toCreateAgentPayload(voiceForm).agent_config.tasks[0];
      expect(before.tools_config.s2s).toBeDefined();
      expect(before.tools_config.transcriber).toBeDefined();

      // Flip the type; the form still holds both blocks and the voice channel.
      const after = toCreateAgentPayload({ ...voiceForm, agent_type: "text" }).agent_config.tasks[0];
      expect(after.tools_config.s2s).toEqual(
        expect.objectContaining({ provider: "openai_realtime" })
      );
      expect(after.tools_config.transcriber).toEqual(expect.objectContaining({ provider: "deepgram" }));
      expect(after.tools_config.synthesizer).toEqual(expect.objectContaining({ provider: "elevenlabs" }));
      expect(after.tools_config.llm_agent).toEqual(expect.objectContaining({ model: "gpt-4o" }));
      expect(after.pipeline).toBe("s2s");
      expect(after.toolchain.pipelines).toEqual([["s2s"], ["transcriber", "llm", "synthesizer"]]);
    });

    it("passes a chat pointer through on voice forms without forcing s2s blocks", () => {
      const payload = toCreateAgentPayload({
        agent_name: "Voice Chat Agent",
        agent_type: "voice",
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        agent_config: { pipeline: "chat", llm: { provider: "openai", model: "gpt-4o" } },
      });
      const task = payload.agent_config.tasks[0];
      expect(task.pipeline).toBe("chat");
      expect(task.tools_config.s2s).toBeUndefined();
      expect(task.tools_config.transcriber).toBeDefined();
      expect(task.toolchain.pipelines).toEqual([["transcriber", "llm", "synthesizer"]]);
    });

    it("legacy untouched forms stay byte-identical (exact block key sets)", () => {
      const keySet = (o: object) => Object.keys(o).sort();
      const sysPrompt = "You are a helpful assistant.";

      const voice = toCreateAgentPayload({
        agent_name: "Legacy Voice",
        agent_type: "voice",
        agent_prompts: { system_prompt: sysPrompt },
        agent_config: {},
      }).agent_config.tasks[0];
      expect(keySet(voice.tools_config)).toEqual(["llm_agent", "synthesizer", "transcriber"]);
      expect(voice.toolchain.pipelines).toEqual([["transcriber", "llm", "synthesizer"]]);
      expect("pipeline" in voice).toBe(false);

      const text = toCreateAgentPayload({
        agent_name: "Legacy Text",
        agent_type: "text",
        agent_prompts: { system_prompt: sysPrompt },
        agent_config: {},
      }).agent_config.tasks[0];
      expect(keySet(text.tools_config)).toEqual(["input", "llm_agent", "output"]);
      expect(text.toolchain.pipelines).toEqual([["llm"]]);
      expect("pipeline" in text).toBe(false);

      const s2s = toCreateAgentPayload({
        agent_name: "Legacy S2S",
        agent_type: "s2s",
        agent_prompts: { system_prompt: sysPrompt },
        agent_config: {},
      }).agent_config.tasks[0];
      // Pure s2s keeps its legacy brainless shape — no llm, no voice blocks.
      expect(keySet(s2s.tools_config)).toEqual(["s2s"]);
      expect(s2s.toolchain.pipelines).toEqual([["s2s"]]);
      expect("pipeline" in s2s).toBe(false);
    });

    it("toUpdateAgentPayload threads channels through (fallback stays type-derived)", () => {
      const hybrid = toUpdateAgentPayload(
        "Hybrid Agent",
        "text",
        "You are a helpful assistant.",
        undefined,
        { llm: { provider: "openai", model: "gpt-4o" } },
        ["voice", "chat"]
      );
      expect(hybrid.agent_config.channels).toEqual(["voice", "chat"]);
      // The voice channel drives voice-block emission on the PUT payload.
      expect(hybrid.agent_config.tasks[0].tools_config.transcriber).toBeDefined();

      const fallback = toUpdateAgentPayload("Text Agent", "text", "You are a helpful assistant.", "Hi", {});
      expect(fallback.agent_config.channels).toEqual(["chat"]);
      expect(fallback.agent_config.agent_welcome_message).toBe("Hi");
    });

    it("round-trips a both-blocks record without misreporting routing", () => {
      const agent = toFrontendAgent({
        agent_id: "hybrid-1",
        data: {
          agent_name: "Hybrid Agent",
          agent_type: "voice",
          channels: ["voice", "chat"],
          tasks: [
            {
              pipeline: "s2s",
              tools_config: {
                s2s: { provider: "openai_realtime", provider_config: { model: "gpt-realtime-2.1" } },
                transcriber: { provider: "deepgram", model: "nova-2" },
                synthesizer: {
                  provider: "elevenlabs",
                  provider_config: { voice: "Rachel", model: "eleven_turbo_v2_5" },
                },
                llm_agent: { provider: "openai", model: "gpt-4o" },
              },
              toolchain: {
                execution: "parallel",
                pipelines: [["s2s"], ["transcriber", "llm", "synthesizer"]],
              },
              task_config: {},
            },
          ],
        },
        agent_prompts: { task_1: { system_prompt: "You are a helpful voice assistant." } },
      });
      expect(agent.agent_config.pipeline).toBe("s2s");
      expect(agent.agent_config.s2s?.provider).toBe("openai_realtime");
      expect(agent.agent_config.transcriber?.provider).toBe("deepgram");
      expect(agent.channels).toEqual(["voice", "chat"]);

      const repayload = toCreateAgentPayload({
        agent_name: agent.agent_name,
        agent_type: agent.agent_type,
        agent_prompts: { system_prompt: "You are a helpful voice assistant." },
        channels: agent.channels,
        agent_config: agent.agent_config,
      }).agent_config.tasks[0];
      expect(repayload.pipeline).toBe("s2s");
      expect(repayload.tools_config.s2s).toBeDefined();
      expect(repayload.tools_config.transcriber).toBeDefined();
      expect(repayload.tools_config.synthesizer).toBeDefined();
      expect(repayload.toolchain.pipelines).toEqual([["s2s"], ["transcriber", "llm", "synthesizer"]]);
    });

    it("derives the toggle from toolchain order for both-blocks records lacking a pointer", () => {
      const bothTools = {
        s2s: { provider: "openai_realtime", provider_config: { model: "gpt-realtime-2.1" } },
        transcriber: { provider: "deepgram", model: "nova-2" },
        synthesizer: { provider: "elevenlabs", provider_config: { voice: "Rachel" } },
        llm_agent: { provider: "openai", model: "gpt-4o" },
      };
      const s2sFirst = toFrontendAgent({
        agent_id: "h1",
        data: {
          agent_name: "H",
          agent_type: "voice",
          tasks: [
            {
              tools_config: bothTools,
              toolchain: { execution: "parallel", pipelines: [["s2s"], ["transcriber", "llm", "synthesizer"]] },
            },
          ],
        },
      });
      expect(s2sFirst.agent_config.pipeline).toBe("s2s");

      const asrFirst = toFrontendAgent({
        agent_id: "h2",
        data: {
          agent_name: "H",
          agent_type: "voice",
          tasks: [
            {
              tools_config: bothTools,
              toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"], ["s2s"]] },
            },
          ],
        },
      });
      expect(asrFirst.agent_config.pipeline).toBe("asr");

      // Single-block records without a pointer stay untouched (legacy inference).
      const single = toFrontendAgent({
        agent_id: "h3",
        data: {
          agent_name: "H",
          agent_type: "voice",
          tasks: [
            {
              tools_config: { transcriber: { provider: "deepgram" } },
              toolchain: { execution: "parallel", pipelines: [["transcriber", "llm", "synthesizer"]] },
            },
          ],
        },
      });
      expect(single.agent_config.pipeline).toBeUndefined();
    });
  });
});
