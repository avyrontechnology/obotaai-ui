import { toCreateAgentPayload, toFrontendAgent, templatePayloadToAgentData, stripNulls } from "@/services/api-transforms";
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
});
