/**
 * @jest-environment node
 *
 * Live end-to-end contract test: dummy agent with every field filled,
 * verified field-by-field through create → read → update → read → delete
 * against a real backend (default http://localhost:5001).
 * Node env: apiClient needs a real fetch, which jsdom does not provide.
 *
 * Gated by OTOBAI_E2E=1 — skipped in normal runs. Run with:
 *   OTOBAI_E2E=1 npm test -- __tests__/services/agent-e2e.test.ts
 *
 * Backend notes (verified in ../voiceai):
 * - PUT /agent/:id fully overwrites the record + prompts file.
 * - ElevenLabsConfig persists voice/voice_id/model/temperature/
 *   similarity_boost/speed/style; further provider_config extras are
 *   accepted but ignored server-side (pydantic extra=ignore), so they are
 *   sent (backend 200s) but not asserted on read.
 * - agent_config.rag has no backend slot (knowledge goes through
 *   /knowledgebases + /agents/:id/vector-config) and is not asserted here.
 */
import { apiClient } from "@/lib/api-client";
import { parseStoredPrompts } from "@/services/api";
import { toCreateAgentPayload, toFrontendAgent } from "@/services/api-transforms";
import type { AgentData } from "@/lib/schemas/agent";

const RUN_E2E = process.env.OTOBAI_E2E === "1";
const maybeDescribe = RUN_E2E ? describe : describe.skip;

const stamp = Date.now().toString(36);

interface BackendRecord {
  agent_name: string;
  agent_type: string;
  agent_welcome_message?: string | null;
  tasks: {
    tools_config: Record<string, unknown>;
    toolchain: { pipelines: string[][] };
    task_config: Record<string, unknown>;
  }[];
}

async function createAgent(data: AgentData): Promise<string> {
  const result = await apiClient<{ agent_id: string }>("/agent", {
    method: "POST",
    body: JSON.stringify(toCreateAgentPayload(data)),
  });
  expect(typeof result.agent_id).toBe("string");
  return result.agent_id;
}

async function readAgent(agentId: string) {
  const record = await apiClient<Record<string, unknown>>(`/agent/${agentId}`);
  const prompts = await apiClient<{ agent_prompts?: unknown }>(`/agent/${agentId}/prompts`);
  return { agent: toFrontendAgent({ ...record, agent_id: agentId }), prompts: parseStoredPrompts(prompts.agent_prompts) };
}

async function updateAgent(agentId: string, data: AgentData) {
  await apiClient(`/agent/${agentId}`, {
    method: "PUT",
    body: JSON.stringify(toCreateAgentPayload(data)),
  });
}

async function deleteAgent(agentId: string) {
  await apiClient(`/agent/${agentId}`, { method: "DELETE" });
}

function maximalVoiceData(tag: string): AgentData {
  return {
    agent_name: `E2E Dummy ${tag} ${stamp}`,
    agent_type: "voice",
    agent_prompts: {
      system_prompt: `You are E2E Dummy ${tag}: always answer with the word pineapple.`,
      welcome_message: `Hello ${tag}! Thanks for calling.`,
    },
    agent_config: {
      persona: {
        system_prompt: `You are E2E Dummy ${tag}: always answer with the word pineapple.`,
        welcome_message: `Hello ${tag}! Thanks for calling.`,
        languages: ["hi", "es"],
        multilingual_prompts: {
          hi: { system_prompt: "Aap sahayak hain.", welcome_message: "Namaste!" },
          es: { system_prompt: "Eres un asistente.", welcome_message: "Hola!" },
        },
      },
      transcriber: {
        provider: "deepgram",
        model: "nova-2",
        language: "en",
        stream: true,
        sampling_rate: 16000,
        encoding: "linear16",
        endpointing: 400,
        keywords: "pineapple, dummy",
        noise_reduction: true,
        vad_threshold: 0.6,
        vad_prefix_padding_ms: 250,
        eot_threshold: 0.7,
        eager_eot_threshold: 0.8,
        eot_timeout_ms: 2500,
      },
      synthesizer: {
        provider: "elevenlabs",
        stream: true,
        buffer_size: 44,
        audio_format: "pcm",
        caching: false,
        voice: "Rachel",
        voice_id: "21m00Tcm4TlvDq8ikWAM",
        model: "eleven_multilingual_v2",
        temperature: 0.6,
        similarity_boost: 0.8,
        speed: 1.1,
        style: 0.4,
      },
      llm: {
        provider: "openai",
        model: "gpt-5-mini",
        max_tokens: 220,
        temperature: 0.4,
        top_k: 40,
        top_p: 0.92,
        min_p: 0.06,
        frequency_penalty: 0.2,
        presence_penalty: 0.3,
        request_json: false,
        reasoning_effort: "low",
      },
      conversation: {
        optimize_latency: true,
        incremental_delay: 120,
        ambient_noise: true,
        use_fillers: true,
        backchanneling: true,
        backchanneling_message_gap: 7,
        backchanneling_start_delay: 6,
        hangup_after_silence: 15,
        number_of_words_for_interruption: 4,
        interruption_backoff_period: 1200,
        check_if_user_online: true,
        trigger_user_online_message_after: 6000,
        check_user_online_message: "Are you still there?",
        voicemail: true,
        voicemail_detection_duration: 4,
        voicemail_check_interval: 2,
        voicemail_min_transcript_length: 6,
        dtmf_enabled: true,
        call_terminate: 120,
        hangup_after_LLMCall: false,
        call_cancellation_prompt: "cancel everything",
      },
      telephony: {
        input_provider: "twilio",
        input_format: "wav",
        output_provider: "twilio",
        output_format: "wav",
      },
    },
  };
}

function expectVoiceRecordMatches(record: BackendRecord, data: AgentData) {
  expect(record.agent_name).toBe(data.agent_name);
  expect(record.agent_type).toBe("voice");
  expect(record.tasks).toHaveLength(1);
  const task = record.tasks[0];
  expect(task.toolchain.pipelines).toEqual([["transcriber", "llm", "synthesizer"]]);

  const tools = task.tools_config as Record<string, Record<string, unknown>>;
  const llm = tools.llm_agent;
  expect(llm).toEqual(
    expect.objectContaining({
      provider: "openai",
      model: data.agent_config.llm?.model,
      max_tokens: 220,
      temperature: 0.4,
      top_k: 40,
      top_p: 0.92,
      min_p: 0.06,
      frequency_penalty: 0.2,
      presence_penalty: 0.3,
      request_json: false,
      reasoning_effort: "low",
    })
  );

  const stt = tools.transcriber;
  expect(stt).toEqual(
    expect.objectContaining({
      provider: "deepgram",
      model: "nova-2",
      language: "en",
      stream: true,
      sampling_rate: 16000,
      encoding: "linear16",
      endpointing: 400,
      keywords: "pineapple, dummy",
      noise_reduction: true,
      vad_threshold: 0.6,
      vad_prefix_padding_ms: 250,
      eot_threshold: 0.7,
      eager_eot_threshold: 0.8,
      eot_timeout_ms: 2500,
    })
  );

  const tts = tools.synthesizer;
  expect(tts.provider).toBe("elevenlabs");
  expect(tts.stream).toBe(true);
  expect(tts.buffer_size).toBe(44);
  expect(tts.audio_format).toBe("pcm");
  expect(tts.caching).toBe(false);
  expect(tts.provider_config).toEqual(
    expect.objectContaining({
      voice: "Rachel",
      voice_id: "21m00Tcm4TlvDq8ikWAM",
      model: "eleven_multilingual_v2",
      temperature: 0.6,
      similarity_boost: 0.8,
      speed: 1.1,
      style: 0.4,
    })
  );

  expect(tools.input).toEqual(expect.objectContaining({ provider: "twilio", format: "wav" }));
  expect(tools.output).toEqual(expect.objectContaining({ provider: "twilio", format: "wav" }));

  expect(task.task_config).toEqual(
    expect.objectContaining({
      optimize_latency: true,
      incremental_delay: 120,
      ambient_noise: true,
      use_fillers: true,
      backchanneling: true,
      backchanneling_message_gap: 7,
      backchanneling_start_delay: 6,
      hangup_after_silence: 15,
      number_of_words_for_interruption: 4,
      interruption_backoff_period: 1200,
      check_if_user_online: true,
      trigger_user_online_message_after: 6000,
      check_user_online_message: "Are you still there?",
      voicemail: true,
      voicemail_detection_duration: 4,
      voicemail_check_interval: 2,
      voicemail_min_transcript_length: 6,
      dtmf_enabled: true,
      call_terminate: 120,
      hangup_after_LLMCall: false,
      call_cancellation_prompt: "cancel everything",
    })
  );

  expect(record.agent_welcome_message).toBe(data.agent_prompts.welcome_message);
}

maybeDescribe("agent end-to-end (live backend)", () => {
  test(
    "voice agent: every field persists through create, populates on read, and updates",
    async () => {
      const created = maximalVoiceData("Voice");
      const agentId = await createAgent(created);
      try {
        // Read back after create — raw record + prompts file.
        const rawAfterCreate = await apiClient<BackendRecord>(`/agent/${agentId}`);
        expectVoiceRecordMatches(rawAfterCreate, created);
        const { agent: loaded, prompts: loadedPrompts } = await readAgent(agentId);
        expect(loaded.agent_id).toBe(agentId);
        expect(loaded.agent_name).toBe(created.agent_name);
        expect(loaded.agent_config.transcriber?.model).toBe("nova-2");
        expect(loaded.agent_config.synthesizer?.voice).toBe("Rachel");
        expect(loaded.agent_config.llm?.model).toBe("gpt-5-mini");
        expect(loaded.agent_config.telephony?.input_provider).toBe("twilio");
        expect(loaded.agent_config.conversation?.call_terminate).toBe(120);
        expect(loadedPrompts.system_prompt).toBe(created.agent_prompts.system_prompt);
        expect(loadedPrompts.multilingual_prompts?.hi?.system_prompt).toBe("Aap sahayak hain.");
        expect(loaded.agent_prompts.welcome_message).toBe(created.agent_prompts.welcome_message);

        // Update every section with new values.
        const updated: AgentData = {
          ...maximalVoiceData("VoiceUpdated"),
          agent_config: {
            ...maximalVoiceData("VoiceUpdated").agent_config,
            transcriber: { provider: "deepgram", model: "nova-3", language: "hi", stream: false },
            synthesizer: {
              provider: "elevenlabs",
              voice: "Rachel",
              voice_id: "21m00Tcm4TlvDq8ikWAM",
              model: "eleven_turbo_v2_5",
              stream: false,
              caching: true,
            },
            llm: { provider: "openai", model: "gpt-4o", temperature: 0.9, request_json: true },
            conversation: { hangup_after_silence: 30, dtmf_enabled: false, use_fillers: false },
            telephony: { input_provider: "plivo", input_format: "wav" },
          },
        };
        await updateAgent(agentId, updated);

        // Read back after update — every change must be populated.
        const rawAfterUpdate = await apiClient<BackendRecord>(`/agent/${agentId}`);
        expect(rawAfterUpdate.agent_name).toBe(updated.agent_name);
        const tools = rawAfterUpdate.tasks[0].tools_config as Record<string, Record<string, unknown>>;
        expect(tools.transcriber).toEqual(expect.objectContaining({ model: "nova-3", language: "hi", stream: false }));
        expect((tools.synthesizer.provider_config as Record<string, unknown>).model).toBe("eleven_turbo_v2_5");
        expect(tools.synthesizer.stream).toBe(false);
        expect(tools.llm_agent).toEqual(expect.objectContaining({ model: "gpt-4o", temperature: 0.9, request_json: true }));
        expect(rawAfterUpdate.tasks[0].task_config).toEqual(
          expect.objectContaining({ hangup_after_silence: 30, dtmf_enabled: false, use_fillers: false })
        );
        expect(tools.input).toEqual(expect.objectContaining({ provider: "plivo" }));
        expect(rawAfterUpdate.agent_welcome_message).toBe(updated.agent_prompts.welcome_message);

        const { agent: reloaded, prompts: reloadedPrompts } = await readAgent(agentId);
        expect(reloaded.agent_config.transcriber?.model).toBe("nova-3");
        expect(reloaded.agent_config.llm?.model).toBe("gpt-4o");
        expect(reloaded.agent_config.telephony?.input_provider).toBe("plivo");
        expect(reloadedPrompts.system_prompt).toBe(updated.agent_prompts.system_prompt);
        expect(reloadedPrompts.multilingual_prompts?.es?.welcome_message).toBe("Hola!");
      } finally {
        await deleteAgent(agentId);
      }
    },
    60000
  );

  test(
    "s2s agent: full provider config persists and updates",
    async () => {
      const created: AgentData = {
        agent_name: `E2E Dummy S2S ${stamp}`,
        agent_type: "s2s",
        agent_prompts: {
          system_prompt: "You are a realtime support agent.",
          welcome_message: "Hey, realtime here.",
        },
        agent_config: {
          persona: { system_prompt: "You are a realtime support agent.", welcome_message: "Hey, realtime here." },
          s2s: {
            provider: "openai_realtime",
            model: "gpt-realtime-2.1",
            voice: "marin",
            language: "en",
            speed: 1.1,
            turn_detection_type: "semantic_vad",
            eagerness: "medium",
            vad_threshold: 0.6,
            vad_silence_duration_ms: 600,
            vad_prefix_padding_ms: 250,
            max_output_tokens: 800,
            transcription_model: "gpt-4o-mini-transcribe",
            welcome_audio_gate_ms: 1200,
          },
          conversation: { optimize_latency: true, hangup_after_silence: 20 },
        },
      };
      const agentId = await createAgent(created);
      try {
        const raw = await apiClient<BackendRecord>(`/agent/${agentId}`);
        const s2s = raw.tasks[0].tools_config.s2s as {
          provider: string;
          provider_config: Record<string, unknown>;
          welcome_audio_gate_ms?: number;
        };
        expect(raw.tasks[0].toolchain.pipelines).toEqual([["s2s"]]);
        expect(s2s.provider_config).toEqual(
          expect.objectContaining({
            model: "gpt-realtime-2.1",
            voice: "marin",
            language: "en",
            speed: 1.1,
            turn_detection_type: "semantic_vad",
            eagerness: "medium",
            vad_threshold: 0.6,
            vad_silence_duration_ms: 600,
            vad_prefix_padding_ms: 250,
            max_output_tokens: 800,
            transcription_model: "gpt-4o-mini-transcribe",
          })
        );
        expect(s2s.welcome_audio_gate_ms).toBe(1200);

        const { agent: loaded, prompts } = await readAgent(agentId);
        expect(loaded.agent_config.s2s?.model).toBe("gpt-realtime-2.1");
        expect(loaded.agent_config.s2s?.speed).toBe(1.1);
        expect(loaded.agent_config.s2s?.transcription_model).toBe("gpt-4o-mini-transcribe");
        expect(prompts.system_prompt).toBe("You are a realtime support agent.");

        await updateAgent(agentId, {
          ...created,
          agent_prompts: { system_prompt: "Updated realtime prompt.", welcome_message: "Yo." },
          agent_config: {
            ...created.agent_config,
            persona: { system_prompt: "Updated realtime prompt.", welcome_message: "Yo." },
            s2s: { provider: "openai_realtime", model: "gpt-realtime-2.1", voice: "echo", speed: 0.9 },
          },
        });

        const rawUpdated = await apiClient<BackendRecord>(`/agent/${agentId}`);
        const s2sUpdated = rawUpdated.tasks[0].tools_config.s2s as {
          provider_config: Record<string, unknown>;
        };
        expect(s2sUpdated.provider_config).toEqual(
          expect.objectContaining({ voice: "echo", speed: 0.9 })
        );
        const { prompts: promptsUpdated } = await readAgent(agentId);
        expect(promptsUpdated.system_prompt).toBe("Updated realtime prompt.");
        expect(rawUpdated.agent_welcome_message).toBe("Yo.");
      } finally {
        await deleteAgent(agentId);
      }
    },
    60000
  );
});
