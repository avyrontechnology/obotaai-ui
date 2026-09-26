/**
 * Bidirectional transforms between the frontend's flat Agent model
 * and the backend's nested CreateAgentPayload / AgentModel structure.
 *
 * Backend schema (from OpenAPI):
 *   CreateAgentPayload = { agent_config: AgentModel, agent_prompts: Record<string, Record<string, string>> | null }
 *   AgentModel = { agent_name, agent_type, tasks: Task[], agent_welcome_message }
 *   Task = { tools_config: ToolsConfig, toolchain: ToolsChainModel, task_type, task_config: ConversationConfig }
 *   ToolsConfig = { llm_agent, synthesizer, transcriber, ... }
 */

import type { AgentData } from "@/lib/schemas/agent";
import type { Agent, AgentConfig } from "./api";

// ─── Backend Payload Types ───────────────────────────────────────────────────

export interface BackendToolsConfig {
  llm_agent?: Record<string, unknown> | null;
  synthesizer?: Record<string, unknown> | null;
  transcriber?: Record<string, unknown> | null;
  input?: Record<string, unknown> | null;
  output?: Record<string, unknown> | null;
  api_tools?: Record<string, unknown> | null;
  s2s?: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface BackendToolchain {
  execution: string;
  pipelines: string[][];
}

export interface BackendConversationConfig {
  optimize_latency?: boolean | null;
  hangup_after_silence?: number | null;
  incremental_delay?: number | null;
  number_of_words_for_interruption?: number | null;
  interruption_backoff_period?: number | null;
  backchanneling?: boolean | null;
  backchanneling_message_gap?: number | null;
  backchanneling_start_delay?: number | null;
  use_fillers?: boolean | null;
  check_if_user_online?: boolean | null;
  trigger_user_online_message_after?: number | null;
  check_user_online_message?: string | Record<string, string> | null;
  voicemail?: boolean | null;
  voicemail_detection_duration?: number | null;
  voicemail_check_interval?: number | null;
  voicemail_min_transcript_length?: number | null;
  dtmf_enabled?: boolean | null;
  call_terminate?: number | null;
  hangup_after_LLMCall?: boolean | null;
  call_cancellation_prompt?: string | null;
  recording?: boolean | null;
  call_hangup_message?: string | Record<string, string> | null;
  welcome_message_delay?: number | null;
  discard_pre_welcome_utterance?: boolean | null;
  language_injection_mode?: string | null;
  language_instruction_template?: string | null;
  end_call_tool_mode?: string | null;
  [key: string]: unknown;
}

export interface BackendTask {
  tools_config: BackendToolsConfig;
  toolchain: BackendToolchain;
  task_type?: string | null;
  task_config?: BackendConversationConfig;
  /** Phase A engine pointer (spec 0028): "asr" | "s2s". Omitted when the
   *  toggle is untouched — backend inference reproduces legacy routing. */
  pipeline?: string | null;
}

export interface BackendAgentModel {
  agent_name: string;
  agent_type?: string;
  tasks: BackendTask[];
  agent_welcome_message?: string | null;
  /** Phase A runtimes (spec 0028). Omitted when unset — the backend defaults
   *  to ["voice"]. Never emit [] (backend min_length=1 rejects it). */
  channels?: string[];
}

/**
 * Derive the `channels` for a create/PUT payload (specs 0028 + 0038, hybrid).
 *
 * Hybrid matrix:
 *   - Explicit non-empty form channels ALWAYS win verbatim (deduped,
 *     order-preserving) — including ["voice", "chat"]. Never emit []: empty
 *     entries are filtered, and an all-empty/omitted list falls through.
 *   - Fallback when the form carries no channels: voice/s2s forms emit
 *     ["voice"], text forms emit ["chat"] (the HTTP chat runtime serves
 *     text agents; the allowlist accepts both since Phase C).
 *   - Other types omit the key so the backend default applies.
 */
export function defaultChannels(data: AgentData): string[] | undefined {
  const explicit = (data.channels ?? []).filter((c) => c.length > 0);
  if (explicit.length > 0) return [...new Set(explicit)];
  if (data.agent_type === "voice" || data.agent_type === "s2s") return ["voice"];
  if (data.agent_type === "text") return ["chat"];
  return undefined;
}

export interface CreateAgentPayload {
  agent_config: BackendAgentModel;
  agent_prompts: Record<string, Record<string, unknown>> | null;
}

/** Shape returned by GET /all → agents[] */
export interface BackendAgentListItem {
  agent_id: string;
  agent_name: string;
  agent_type?: string;
  [key: string]: unknown;
}

// ─── Frontend → Backend Transforms ──────────────────────────────────────────

/**
 * Deep-strip null/undefined values. The backend persists explicit nulls for
 * every unset Optional field; the frontend zod schemas accept undefined but
 * not null, so loaded configs must be cleaned or validation silently blocks
 * every submit. Only null/undefined are removed — false, 0 and "" survive.
 */
export function stripNulls<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripNulls(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    const cleaned: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (entry !== null && entry !== undefined) {
        cleaned[key] = stripNulls(entry);
      }
    }
    return cleaned as T;
  }
  return value;
}

/**
 * Catalog-valid defaults for provider picks that carry no model/voice of
 * their own (the wizard toolchain step picks providers only). Values mirror
 * voiceai/modules/catalog/seed.py: closed rows must match exactly, open rows
 * accept anything so the shared fallback ("nova-2", "gpt-4o", …) validates.
 * Explicit form values always win — these fill only absent fields, so the
 * Configure PUT path (full-overwrite) never clobbers user edits.
 */
const ASR_MODEL_DEFAULTS: Record<string, string> = {
  sarvam: "saaras:v4",
  pixa: "pixa-1",
};
const DEFAULT_ASR_MODEL = "nova-2";

const TTS_DEFAULTS: Record<string, { model: string; voice: string }> = {
  sarvam: { model: "bulbul:v2", voice: "anushka" },
  maya: { model: "Maya 2 Native", voice: "Ananya" },
  kalpa: { model: "kalpa-tts-multilingual-beta-v0.1", voice: "Kiara" },
  polly: { model: "neural", voice: "Rachel" },
  deepgram: { model: "aura-zeus-en", voice: "Rachel" },
  openai: { model: "tts-1", voice: "Rachel" },
  azuretts: { model: "neural", voice: "Rachel" },
  cartesia: { model: "sonic-english", voice: "Rachel" },
  smallest: { model: "lightning_v3.1", voice: "Rachel" },
  rime: { model: "arcana", voice: "Rachel" },
  pixa: { model: "luna-tts", voice: "Rachel" },
};
const DEFAULT_TTS = { model: "eleven_turbo_v2_5", voice: "Rachel" };

const LLM_MODEL_DEFAULTS: Record<string, string> = {
  google: "gemini-3.6-flash",
};
const DEFAULT_LLM_MODEL = "gpt-4o";

const S2S_MODEL_DEFAULTS: Record<string, string> = {
  openai_realtime: "gpt-realtime-2.1",
  gemini_live: "gemini-3.1-flash-live-preview",
};

export function defaultAsrModel(provider: string): string {
  return ASR_MODEL_DEFAULTS[provider] ?? DEFAULT_ASR_MODEL;
}

export function defaultTtsConfig(provider: string): { model: string; voice: string } {
  return TTS_DEFAULTS[provider] ?? DEFAULT_TTS;
}

export function defaultLlmModel(provider: string): string {
  return LLM_MODEL_DEFAULTS[provider] ?? DEFAULT_LLM_MODEL;
}

export function defaultS2sModel(provider: string): string | undefined {
  return S2S_MODEL_DEFAULTS[provider];
}

export interface ApiToolsFormValue {
  tool_refs?: string[];
  webhooks?: Record<string, { ref: string; param?: unknown }>;
  embedded_tools?: unknown[];
  embedded_params?: Record<string, unknown>;
}

/**
 * Build the `api_tools` task block from form attachments (spec 0029 slice 2).
 * Returns undefined when the form carries nothing — untouched agents keep
 * legacy payloads byte-identical. `tools: []` is load-bearing when present:
 * the backend materializes ref definitions into the list, and an absent
 * list would leave refs invisible to the engine.
 */
export function buildApiToolsPayload(
  value: ApiToolsFormValue | undefined
): Record<string, unknown> | undefined {
  const toolRefs = [...(value?.tool_refs ?? [])];
  const webhookParams: Record<string, unknown> = { ...(value?.embedded_params ?? {}) };
  for (const [attachName, attach] of Object.entries(value?.webhooks ?? {})) {
    const entry: Record<string, unknown> = { pre_call_webhook_ref: attach.ref };
    if (attach.param !== undefined) entry.pre_call_webhook_param = attach.param;
    webhookParams[attachName] = entry;
  }
  const embeddedTools = [...(value?.embedded_tools ?? [])];
  if (toolRefs.length === 0 && Object.keys(webhookParams).length === 0 && embeddedTools.length === 0) {
    return undefined;
  }
  return { tool_refs: toolRefs, tools: embeddedTools, tools_params: webhookParams };
}

/**
 * Transform wizard form data into the backend's CreateAgentPayload.
 */
export function toCreateAgentPayload(data: AgentData): CreateAgentPayload {
  const isVoice = data.agent_type === "voice";
  const isS2S = data.agent_type === "s2s";

  // Build the LLM agent config (SimpleLlmAgent shape)
  const llmProvider = data.agent_config?.llm?.provider || data.agent_config?.llm_provider || "openai";
  const llmAgent: Record<string, unknown> = {
    model: data.agent_config?.llm?.model || defaultLlmModel(llmProvider),
    provider: llmProvider,
    family: llmProvider,
    max_tokens: data.agent_config?.llm?.max_tokens || 150,
    temperature: data.agent_config?.llm?.temperature ?? 0.2,
  };

  // Optional LLM fields
  if (data.agent_config?.llm?.top_k != null) llmAgent.top_k = data.agent_config.llm.top_k;
  if (data.agent_config?.llm?.top_p != null) llmAgent.top_p = data.agent_config.llm.top_p;
  if (data.agent_config?.llm?.min_p != null) llmAgent.min_p = data.agent_config.llm.min_p;
  if (data.agent_config?.llm?.frequency_penalty != null) llmAgent.frequency_penalty = data.agent_config.llm.frequency_penalty;
  if (data.agent_config?.llm?.presence_penalty != null) llmAgent.presence_penalty = data.agent_config.llm.presence_penalty;
  if (data.agent_config?.llm?.request_json != null) llmAgent.request_json = data.agent_config.llm.request_json;
  if (data.agent_config?.llm?.reasoning_effort) llmAgent.reasoning_effort = data.agent_config.llm.reasoning_effort;
  // Passthrough extras (no UI controls) — PUT overwrites the whole record.
  if (data.agent_config?.llm?.stop != null) llmAgent.stop = data.agent_config.llm.stop;
  if (data.agent_config?.llm?.base_url) llmAgent.base_url = data.agent_config.llm.base_url;
  if (data.agent_config?.llm?.verbosity) llmAgent.verbosity = data.agent_config.llm.verbosity;
  if (data.agent_config?.llm?.use_responses_api != null) llmAgent.use_responses_api = data.agent_config.llm.use_responses_api;
  if (data.agent_config?.llm?.compact_threshold != null) llmAgent.compact_threshold = data.agent_config.llm.compact_threshold;
  if (data.agent_config?.llm?.agent_flow_type) llmAgent.agent_flow_type = data.agent_config.llm.agent_flow_type;
  if (data.agent_config?.llm?.extraction_details) llmAgent.extraction_details = data.agent_config.llm.extraction_details;
  if (data.agent_config?.llm?.summarization_details) llmAgent.summarization_details = data.agent_config.llm.summarization_details;

  // Build tools_config
  const toolsConfig: BackendToolsConfig = {};

  // Opt-in telephony providers (input/output handlers). Omitted entirely
  // when unconfigured so default engine routing is untouched.
  const telephony = data.agent_config?.telephony;
  if (telephony?.input_provider) {
    toolsConfig.input = { provider: telephony.input_provider, format: telephony.input_format || "wav" };
  }
  if (telephony?.output_provider) {
    toolsConfig.output = { provider: telephony.output_provider, format: telephony.output_format || "wav" };
  }

  // Phase A pipeline toggle (spec 0028) + hybrid channels: the form holds
  // BOTH blocks, a `pipeline` pointer, and top-level `channels`. Untouched
  // toggle + untouched channels (both undefined) reproduce the legacy
  // exclusive payloads byte-for-byte — backend inference routes them.
  // Touched toggle emits both blocks + explicit `pipeline`; BOTH sides must
  // validate (parked is never exempt), so absent parked fields fall back to
  // the same catalog-valid defaults as the active side.
  const rawPipeline = data.agent_config?.pipeline;
  const pipelineSel =
    rawPipeline === "asr" || rawPipeline === "s2s" || rawPipeline === "chat" ? rawPipeline : undefined;
  // Block emission is keyed off channels ∪ agent_type — never agent_type
  // alone. Explicit (deduped, non-empty) form channels drive emission; the
  // defaulted fallback is NOT consulted here, so legacy s2s records (which
  // default to ["voice"]) stay s2s-only and byte-identical. A "voice"
  // channel keeps the ASR voice blocks in the payload even after the type
  // flips to text (PUT fully overwrites — dropping them would wipe the
  // parked side); the form retains both blocks and so must the transform.
  // There is no "s2s" channel (allowlist is {voice, chat}), so s2s blocks
  // still come only from the s2s type or the asr|s2s coexistence toggle.
  // Coexistence (both blocks) is an asr|s2s affair; a stored "chat" pointer
  // passes through verbatim without forcing audio blocks.
  const explicitChannels = [...new Set((data.channels ?? []).filter((c) => c.length > 0))];
  const hasVoiceChannel = explicitChannels.includes("voice");
  const coexisting =
    (pipelineSel === "asr" || pipelineSel === "s2s") && (isVoice || isS2S || hasVoiceChannel);
  const emitS2s = isS2S || coexisting;
  const emitVoice = isVoice || hasVoiceChannel;

  // Pipelines for the toolchain
  const pipelineSteps: string[] = [];
  const parkedSteps: string[] = [];

  if (emitS2s) {
    // Realtime multimodal task: the s2s block replaces discrete STT/LLM/TTS.
    // Field sets are provider-conditional to match the backend
    // OpenAIRealtimeConfig / GeminiLiveConfig validators.
    const s2sProvider = data.agent_config?.s2s?.provider || "openai_realtime";
    const s2sProviderConfig: Record<string, unknown> = {};
    const s2s = data.agent_config?.s2s;
    // A missing model 400s under catalog validation — default per provider
    // (the wizard model input is optional and pre-filled from this).
    const s2sModel = s2s?.model || defaultS2sModel(s2sProvider);
    if (s2sModel) s2sProviderConfig.model = s2sModel;
    if (s2s?.voice) s2sProviderConfig.voice = s2s.voice;
    if (s2s?.language) s2sProviderConfig.language = s2s.language;
    if (s2s?.vad_silence_duration_ms != null) s2sProviderConfig.vad_silence_duration_ms = s2s.vad_silence_duration_ms;
    if (s2s?.vad_prefix_padding_ms != null) s2sProviderConfig.vad_prefix_padding_ms = s2s.vad_prefix_padding_ms;
    if (s2sProvider === "gemini_live") {
      if (s2s?.temperature != null) s2sProviderConfig.temperature = s2s.temperature;
      if (s2s?.start_sensitivity) s2sProviderConfig.start_sensitivity = s2s.start_sensitivity;
      if (s2s?.end_sensitivity) s2sProviderConfig.end_sensitivity = s2s.end_sensitivity;
      if (s2s?.enable_session_resumption != null) s2sProviderConfig.enable_session_resumption = s2s.enable_session_resumption;
      if (s2s?.enable_context_compression != null) s2sProviderConfig.enable_context_compression = s2s.enable_context_compression;
    } else {
      if (s2s?.speed != null) s2sProviderConfig.speed = s2s.speed;
      if (s2s?.turn_detection_type) s2sProviderConfig.turn_detection_type = s2s.turn_detection_type;
      if (s2s?.eagerness) s2sProviderConfig.eagerness = s2s.eagerness;
      if (s2s?.vad_threshold != null) s2sProviderConfig.vad_threshold = s2s.vad_threshold;
      if (s2s?.reasoning_effort) s2sProviderConfig.reasoning_effort = s2s.reasoning_effort;
      if (s2s?.max_output_tokens != null) s2sProviderConfig.max_output_tokens = s2s.max_output_tokens;
      if (s2s?.transcription_model) s2sProviderConfig.transcription_model = s2s.transcription_model;
    }
    const s2sBlock: Record<string, unknown> = { provider: s2sProvider, provider_config: s2sProviderConfig };
    if (s2s?.welcome_audio_gate_ms != null) s2sBlock.welcome_audio_gate_ms = s2s.welcome_audio_gate_ms;
    toolsConfig.s2s = s2sBlock;
    // Active pipeline lands first; parked second. Untouched toggle keeps the
    // legacy single-pipeline shape.
    (coexisting && pipelineSel === "asr" ? parkedSteps : pipelineSteps).push("s2s");
  }

  if (emitVoice || !emitS2s) {
    // Every non-s2s task carries its LLM (text included — and required for
    // chat); the parked side carries one too so flipping the pointer never
    // lands on a missing brain. Pure s2s keeps its legacy brainless shape.
    toolsConfig.llm_agent = llmAgent;
  }

  if (emitVoice) {
    // Transcriber
    const transcriberProvider = data.agent_config?.transcriber?.provider || data.agent_config?.asr_provider || "deepgram";
    toolsConfig.transcriber = {
      provider: transcriberProvider,
      model: data.agent_config?.transcriber?.model || defaultAsrModel(transcriberProvider),
      stream: data.agent_config?.transcriber?.stream ?? false,
      encoding: data.agent_config?.transcriber?.encoding || "linear16",
      sampling_rate: data.agent_config?.transcriber?.sampling_rate || 16000,
      endpointing: data.agent_config?.transcriber?.endpointing || 500,
      ...(data.agent_config?.transcriber?.language && { language: data.agent_config.transcriber.language }),
      ...(data.agent_config?.transcriber?.keywords && { keywords: data.agent_config.transcriber.keywords }),
      ...(data.agent_config?.transcriber?.noise_reduction != null && { noise_reduction: data.agent_config.transcriber.noise_reduction }),
      ...(data.agent_config?.transcriber?.vad_threshold != null && { vad_threshold: data.agent_config.transcriber.vad_threshold }),
      ...(data.agent_config?.transcriber?.vad_prefix_padding_ms != null && { vad_prefix_padding_ms: data.agent_config.transcriber.vad_prefix_padding_ms }),
      ...(data.agent_config?.transcriber?.eot_threshold != null && { eot_threshold: data.agent_config.transcriber.eot_threshold }),
      ...(data.agent_config?.transcriber?.eager_eot_threshold != null && { eager_eot_threshold: data.agent_config.transcriber.eager_eot_threshold }),
      ...(data.agent_config?.transcriber?.eot_timeout_ms != null && { eot_timeout_ms: data.agent_config.transcriber.eot_timeout_ms }),
    };

    // Synthesizer
    const synthProvider = data.agent_config?.synthesizer?.provider || data.agent_config?.tts_provider || "elevenlabs";
    const synthDefaults = defaultTtsConfig(synthProvider);
    const providerConfig: Record<string, unknown> = {
      voice: data.agent_config?.synthesizer?.voice || synthDefaults.voice,
      voice_id: data.agent_config?.synthesizer?.voice_id || "21m00Tcm4TlvDq8ikWAM",
      model: data.agent_config?.synthesizer?.model || synthDefaults.model,
    };
    if (data.agent_config?.synthesizer?.temperature != null) providerConfig.temperature = data.agent_config.synthesizer.temperature;
    if (data.agent_config?.synthesizer?.similarity_boost != null) providerConfig.similarity_boost = data.agent_config.synthesizer.similarity_boost;
    if (data.agent_config?.synthesizer?.speed != null) providerConfig.speed = data.agent_config.synthesizer.speed;
    if (data.agent_config?.synthesizer?.style != null) providerConfig.style = data.agent_config.synthesizer.style;
    if (data.agent_config?.synthesizer?.engine) providerConfig.engine = data.agent_config.synthesizer.engine;
    if (data.agent_config?.synthesizer?.language) providerConfig.language = data.agent_config.synthesizer.language;
    if (data.agent_config?.synthesizer?.top_p != null) providerConfig.top_p = data.agent_config.synthesizer.top_p;
    if (data.agent_config?.synthesizer?.repetition_penalty != null) providerConfig.repetition_penalty = data.agent_config.synthesizer.repetition_penalty;
    if (data.agent_config?.synthesizer?.acoustic_temperature != null) providerConfig.acoustic_temperature = data.agent_config.synthesizer.acoustic_temperature;
    if (data.agent_config?.synthesizer?.audio_quality) providerConfig.audio_quality = data.agent_config.synthesizer.audio_quality;
    if (data.agent_config?.synthesizer?.max_new_tokens != null) providerConfig.max_new_tokens = data.agent_config.synthesizer.max_new_tokens;

    toolsConfig.synthesizer = {
      provider: synthProvider,
      provider_config: providerConfig,
      stream: data.agent_config?.synthesizer?.stream ?? false,
      buffer_size: data.agent_config?.synthesizer?.buffer_size || 40,
      audio_format: data.agent_config?.synthesizer?.audio_format || "pcm",
      caching: data.agent_config?.synthesizer?.caching ?? true,
    };

    (coexisting && pipelineSel === "s2s" ? parkedSteps : pipelineSteps).push("transcriber", "llm", "synthesizer");
  }

  if (!emitS2s && !emitVoice) {
    // Text-only pipeline
    if (!toolsConfig.input) toolsConfig.input = { provider: "default", format: "wav" };
    if (!toolsConfig.output) toolsConfig.output = { provider: "default", format: "wav" };
    pipelineSteps.push("llm");
  }

  // Build conversation/task config from our flat conversation settings
  const taskConfig: BackendConversationConfig = {};
  if (data.agent_config?.conversation) {
    const conv = data.agent_config.conversation;
    if (conv.optimize_latency != null) taskConfig.optimize_latency = conv.optimize_latency;
    if (conv.incremental_delay != null) taskConfig.incremental_delay = conv.incremental_delay;
    if (conv.use_fillers != null) taskConfig.use_fillers = conv.use_fillers;
    if (conv.backchanneling != null) taskConfig.backchanneling = conv.backchanneling;
    if (conv.backchanneling_message_gap != null) taskConfig.backchanneling_message_gap = conv.backchanneling_message_gap;
    if (conv.backchanneling_start_delay != null) taskConfig.backchanneling_start_delay = conv.backchanneling_start_delay;
    if (conv.hangup_after_silence != null) taskConfig.hangup_after_silence = conv.hangup_after_silence;
    if (conv.number_of_words_for_interruption != null) taskConfig.number_of_words_for_interruption = conv.number_of_words_for_interruption;
    if (conv.interruption_backoff_period != null) taskConfig.interruption_backoff_period = conv.interruption_backoff_period;
    if (conv.check_if_user_online != null) taskConfig.check_if_user_online = conv.check_if_user_online;
    if (conv.trigger_user_online_message_after != null) taskConfig.trigger_user_online_message_after = conv.trigger_user_online_message_after;
    if (conv.check_user_online_message != null) taskConfig.check_user_online_message = conv.check_user_online_message;
    if (conv.voicemail != null) taskConfig.voicemail = conv.voicemail;
    if (conv.voicemail_detection_duration != null) taskConfig.voicemail_detection_duration = conv.voicemail_detection_duration;
    if (conv.voicemail_check_interval != null) taskConfig.voicemail_check_interval = conv.voicemail_check_interval;
    if (conv.voicemail_min_transcript_length != null) taskConfig.voicemail_min_transcript_length = conv.voicemail_min_transcript_length;
    if (conv.dtmf_enabled != null) taskConfig.dtmf_enabled = conv.dtmf_enabled;
    if (conv.call_terminate != null) taskConfig.call_terminate = conv.call_terminate;
    if (conv.hangup_after_LLMCall != null) taskConfig.hangup_after_LLMCall = conv.hangup_after_LLMCall;
    if (conv.call_cancellation_prompt != null) taskConfig.call_cancellation_prompt = conv.call_cancellation_prompt;
    if (conv.recording != null) taskConfig.recording = conv.recording;
    if (conv.call_hangup_message != null) taskConfig.call_hangup_message = conv.call_hangup_message;
    if (conv.welcome_message_delay != null) taskConfig.welcome_message_delay = conv.welcome_message_delay;
    if (conv.discard_pre_welcome_utterance != null) taskConfig.discard_pre_welcome_utterance = conv.discard_pre_welcome_utterance;
    if (conv.language_injection_mode != null) taskConfig.language_injection_mode = conv.language_injection_mode;
    if (conv.language_instruction_template != null) taskConfig.language_instruction_template = conv.language_instruction_template;
    if (conv.end_call_tool_mode != null) taskConfig.end_call_tool_mode = conv.end_call_tool_mode;
  }

  // Shared tool attachments (spec 0029 slice 2): refs + webhook params from
  // form state. Emitted only when the form carries attachments — untouched
  // agents keep legacy payloads byte-identical.
  const apiToolsPayload = buildApiToolsPayload(data.agent_config?.api_tools);
  if (apiToolsPayload) {
    toolsConfig.api_tools = apiToolsPayload;
  }

  const task: BackendTask = {
    tools_config: toolsConfig,
    toolchain: {
      execution: "parallel",
      // Coexistence lists the active pipeline first, parked second; legacy
      // single-pipeline shape is untouched when the toggle is unused.
      pipelines: coexisting ? [pipelineSteps, parkedSteps] : [pipelineSteps],
    },
    task_type: "conversation",
    task_config: taskConfig,
    // Explicit pointer wins on the backend; absent infers legacy routing. A
    // stored "chat" pointer re-emits verbatim (never dropped, never forcing
    // blocks). asr|s2s escape only via coexistence — emitting one on a task
    // without its blocks would misroute the engine past inference.
    ...(coexisting && pipelineSel ? { pipeline: pipelineSel } : {}),
    ...(pipelineSel === "chat" ? { pipeline: "chat" } : {}),
  };

  // Build agent_prompts in backend format: { "task_1": { "system_prompt": "..." } }
  // Persona fields take precedence when set, falling back to wizard prompts.
  const persona = data.agent_config?.persona;
  const taskPrompts: Record<string, unknown> = {
    system_prompt: persona?.system_prompt || data.agent_prompts?.system_prompt || "You are a helpful AI assistant.",
  };
  if (persona?.multilingual_prompts) {
    taskPrompts.multilingual_prompts = persona.multilingual_prompts;
  }
  const agentPrompts: Record<string, Record<string, unknown>> = {
    task_1: taskPrompts,
  };

  const agentModel: BackendAgentModel = {
    agent_name: data.agent_name,
    agent_type: data.agent_type || "other",
    tasks: [task],
    agent_welcome_message:
      persona?.welcome_message || data.agent_prompts?.welcome_message || null,
  };
  const channels = defaultChannels(data);
  if (channels) agentModel.channels = channels;

  return {
    agent_config: agentModel,
    agent_prompts: agentPrompts,
  };
}

/**
 * Convert a template agent_payload ({agent_name, agent_type, tasks, agent_prompts})
 * into flat AgentData for the create-agent flow. Reuses toFrontendAgent by
 * shaping the payload like a backend agent record.
 */
export function templatePayloadToAgentData(payload: Record<string, unknown>): AgentData {
  const prompts = (payload.agent_prompts as Record<string, string> | undefined) ?? {};
  const agent = toFrontendAgent({
    agent_id: "",
    data: {
      agent_name: payload.agent_name,
      agent_type: payload.agent_type,
      agent_welcome_message: prompts.welcome_message ?? "",
      tasks: payload.tasks,
      ...(Array.isArray(payload.channels) ? { channels: payload.channels } : {}),
    },
    agent_prompts: { task_1: prompts },
  });
  return {
    agent_name: agent.agent_name,
    agent_type: agent.agent_type,
    agent_prompts: {
      system_prompt: agent.agent_prompts.system_prompt ?? "You are a helpful AI assistant.",
      welcome_message: agent.agent_prompts.welcome_message,
    },
    agent_config: agent.agent_config,
    ...(agent.channels ? { channels: agent.channels } : {}),
  };
}

/**
 * Transform settings form data (AgentConfig) into the backend's CreateAgentPayload for PUT.
 *
 * `channels` lives top-level on AgentData (not inside AgentConfig), so it is
 * threaded through as an explicit argument; omitted/empty falls back to the
 * type-derived default via defaultChannels (voice/s2s → ["voice"],
 * text → ["chat"]).
 */
export function toUpdateAgentPayload(
  agentName: string,
  agentType: string,
  systemPrompt: string,
  welcomeMessage: string | undefined,
  config: AgentConfig,
  channels?: string[]
): CreateAgentPayload {
  // Re-use the create transform with a synthetic AgentData
  const syntheticData: AgentData = {
    agent_name: agentName,
    agent_type: agentType,
    agent_prompts: {
      system_prompt: systemPrompt,
      welcome_message: welcomeMessage,
    },
    agent_config: config,
    ...(channels ? { channels } : {}),
  };
  return toCreateAgentPayload(syntheticData);
}

/**
 * Transform backend agent list item into our frontend Agent type.
 *
 * The backend GET /all returns:
 *   { agent_id, data: { agent_name, agent_type, tasks[], agent_welcome_message, ... } }
 *
 * The backend GET /agent/{id} may return:
 *   { agent_id, agent_name, agent_config: { ... }, agent_prompts: { ... } }
 *   or the same shape as GET /all.
 *
 * We normalize both into our flat frontend Agent type.
 */
export function toFrontendAgent(raw: Record<string, unknown>): Agent {
  const agentId = (raw.agent_id as string) || "";

  let agentType = "other";
  let agentName = "Unnamed Agent";
  let systemPrompt = "";
  let welcomeMessage = "";
  const agentConfig: AgentConfig = {};

  // The backend nests the real data under:
  //   `data` (GET /all) — { agent_id, data: { agent_name, tasks, ... } }
  //   `agent_config` (POST/PUT response)
  //   or at top level (GET /agent/{id}) — { agent_name, tasks, ... }
  const nestedData =
    (raw.data as Record<string, unknown>) ||
    (raw.agent_config as Record<string, unknown>) ||
    (raw.tasks ? raw as Record<string, unknown> : undefined);

  if (nestedData?.tasks) {
    // Nested structure: data.agent_name, data.tasks, etc.
    agentName = (nestedData.agent_name as string) || "Unnamed Agent";
    agentType = (nestedData.agent_type as string) || "other";
    welcomeMessage = (nestedData.agent_welcome_message as string) || "";

    // Phase A engine pointer (spec 0028) + hybrid readback: report the
    // effective routing for coexisting blocks. A stored asr|s2s|chat pointer
    // is read verbatim (absent stays absent — legacy inference). A record
    // that carries BOTH blocks but no pointer (merged single pipeline, or a
    // pointer wiped upstream) derives the toggle from toolchain order —
    // first pipeline wins — so a PUT round-trip re-emits both blocks instead
    // of silently dropping the parked side (PUT fully overwrites). Single-
    // block records never trigger the derivation, so legacy reads are
    // untouched.
    const firstTask = (nestedData.tasks as BackendTask[])[0];
    const storedPipeline: unknown = firstTask?.pipeline;
    if (storedPipeline === "asr" || storedPipeline === "s2s" || storedPipeline === "chat") {
      agentConfig.pipeline = storedPipeline;
    } else {
      const firstTools = firstTask?.tools_config ?? {};
      const hasS2sBlock = !!firstTools.s2s;
      const hasVoiceBlock = !!(firstTools.transcriber || firstTools.synthesizer);
      if (hasS2sBlock && hasVoiceBlock) {
        const firstPipeline = firstTask?.toolchain?.pipelines?.[0] ?? [];
        agentConfig.pipeline = firstPipeline.includes("s2s") ? "s2s" : "asr";
      }
    }

    const tasks = nestedData.tasks as BackendTask[];
    if (tasks.length > 0) {
      const task = tasks[0];
      const tc = task.tools_config || {};

      // Extract transcriber
      if (tc.transcriber) {
        agentConfig.transcriber = tc.transcriber as unknown as AgentConfig["transcriber"];
      }

      // Extract synthesizer — flatten provider_config back into our flat shape
      if (tc.synthesizer) {
        const synth = tc.synthesizer as Record<string, unknown>;
        const provConfig = (synth.provider_config as Record<string, unknown>) || {};
        agentConfig.synthesizer = {
          provider: (synth.provider as string) || "elevenlabs",
          stream: synth.stream as boolean | undefined,
          buffer_size: synth.buffer_size as number | undefined,
          audio_format: synth.audio_format as string | undefined,
          caching: synth.caching as boolean | undefined,
          voice: provConfig.voice as string | undefined,
          voice_id: provConfig.voice_id as string | undefined,
          model: provConfig.model as string | undefined,
          temperature: provConfig.temperature as number | undefined,
          similarity_boost: provConfig.similarity_boost as number | undefined,
          speed: provConfig.speed as number | undefined,
          style: provConfig.style as number | undefined,
          engine: provConfig.engine as string | undefined,
          language: provConfig.language as string | undefined,
          top_p: provConfig.top_p as number | undefined,
          repetition_penalty: provConfig.repetition_penalty as number | undefined,
          acoustic_temperature: provConfig.acoustic_temperature as number | undefined,
          audio_quality: provConfig.audio_quality as string | undefined,
          max_new_tokens: provConfig.max_new_tokens as number | undefined,
        };
      }

      // Extract telephony handlers (input/output). The backend's "default"
      // provider means "no explicit routing", so normalize it back to
      // unset — otherwise the selects can never return to default.
      const input = tc.input as Record<string, unknown> | undefined;
      const output = tc.output as Record<string, unknown> | undefined;
      if (input?.provider || output?.provider) {
        const nonDefault = (value: unknown) =>
          typeof value === "string" && value !== "default" ? value : undefined;
        agentConfig.telephony = {
          input_provider: nonDefault(input?.provider),
          input_format: (input?.format as string | undefined) ?? undefined,
          output_provider: nonDefault(output?.provider),
          output_format: (output?.format as string | undefined) ?? undefined,
        };
      }

      // Extract S2S config (realtime multimodal task). Field set mirrors
      // the backend OpenAIRealtimeConfig / GeminiLiveConfig plus the
      // S2S-level welcome_audio_gate_ms.
      if (tc.s2s) {
        const s2s = tc.s2s as Record<string, unknown>;
        const providerConfig = (s2s.provider_config as Record<string, unknown>) || {};
        agentConfig.s2s = {
          provider: s2s.provider as string | undefined,
          model: providerConfig.model as string | undefined,
          voice: providerConfig.voice as string | undefined,
          language: providerConfig.language as string | undefined,
          vad_silence_duration_ms: providerConfig.vad_silence_duration_ms as number | undefined,
          vad_prefix_padding_ms: providerConfig.vad_prefix_padding_ms as number | undefined,
          welcome_audio_gate_ms: s2s.welcome_audio_gate_ms as number | undefined,
          speed: providerConfig.speed as number | undefined,
          turn_detection_type: providerConfig.turn_detection_type as string | undefined,
          eagerness: providerConfig.eagerness as string | undefined,
          vad_threshold: providerConfig.vad_threshold as number | undefined,
          reasoning_effort: providerConfig.reasoning_effort as "low" | "medium" | "high" | undefined,
          max_output_tokens: providerConfig.max_output_tokens as number | undefined,
          transcription_model: providerConfig.transcription_model as string | undefined,
          temperature: providerConfig.temperature as number | undefined,
          start_sensitivity: providerConfig.start_sensitivity as string | undefined,
          end_sensitivity: providerConfig.end_sensitivity as string | undefined,
          enable_session_resumption: providerConfig.enable_session_resumption as boolean | undefined,
          enable_context_compression: providerConfig.enable_context_compression as boolean | undefined,
        };
      }

      // Extract LLM config from llm_agent (SimpleLlmAgent). Extras without
      // UI controls ride along so the full-overwrite PUT cannot wipe them.
      if (tc.llm_agent) {
        const llm = tc.llm_agent as Record<string, unknown>;
        agentConfig.llm = {
          provider: (llm.provider as string) || "openai",
          model: (llm.model as string) || "gpt-4o",
          max_tokens: llm.max_tokens as number | undefined,
          temperature: llm.temperature as number | undefined,
          top_k: llm.top_k as number | undefined,
          top_p: llm.top_p as number | undefined,
          min_p: llm.min_p as number | undefined,
          frequency_penalty: llm.frequency_penalty as number | undefined,
          presence_penalty: llm.presence_penalty as number | undefined,
          request_json: llm.request_json as boolean | undefined,
          reasoning_effort: llm.reasoning_effort as "low" | "medium" | "high" | undefined,
          stop: llm.stop as string[] | undefined,
          base_url: llm.base_url as string | undefined,
          verbosity: llm.verbosity as string | undefined,
          use_responses_api: llm.use_responses_api as boolean | undefined,
          compact_threshold: llm.compact_threshold as number | undefined,
          agent_flow_type: llm.agent_flow_type as string | undefined,
          extraction_details: llm.extraction_details as string | undefined,
          summarization_details: llm.summarization_details as string | undefined,
        };
      }

      // Extract conversation config from task_config
      if (task.task_config) {
        agentConfig.conversation = task.task_config as unknown as AgentConfig["conversation"];
      }

      // Extract tool attachments (spec 0029 slice 2): shared ref ids plus
      // webhook params. tools_params entries carrying pre_call_webhook_ref
      // become managed attachments; everything else rides opaque so PUT
      // cannot wipe legacy embedded entries.
      const rawApiTools = tc.api_tools as Record<string, unknown> | undefined;
      if (rawApiTools && typeof rawApiTools === "object") {
        const refs = Array.isArray(rawApiTools.tool_refs)
          ? rawApiTools.tool_refs.filter((r): r is string => typeof r === "string")
          : [];
        const webhooks: Record<string, { ref: string; param?: unknown }> = {};
        const embeddedParams: Record<string, unknown> = {};
        const rawParams = rawApiTools.tools_params;
        if (rawParams && typeof rawParams === "object" && !Array.isArray(rawParams)) {
          for (const [key, value] of Object.entries(rawParams as Record<string, unknown>)) {
            if (value && typeof value === "object" && !Array.isArray(value)) {
              const entry = value as Record<string, unknown>;
              if (typeof entry.pre_call_webhook_ref === "string" && entry.pre_call_webhook_ref.length > 0) {
                webhooks[key] = { ref: entry.pre_call_webhook_ref };
                if (entry.pre_call_webhook_param !== undefined && entry.pre_call_webhook_param !== null) {
                  webhooks[key].param = entry.pre_call_webhook_param;
                }
                continue;
              }
            }
            embeddedParams[key] = value;
          }
        }
        const embeddedTools = Array.isArray(rawApiTools.tools) ? rawApiTools.tools : [];
        if (refs.length > 0 || Object.keys(webhooks).length > 0 || embeddedTools.length > 0 || Object.keys(embeddedParams).length > 0) {
          agentConfig.api_tools = {
            tool_refs: refs,
            webhooks,
            embedded_tools: embeddedTools,
            embedded_params: embeddedParams,
          };
        }
      }
    }
  } else {
    // Flat response — use top-level fields
    agentName = (raw.agent_name as string) || "Unnamed Agent";
    agentType = (raw.agent_type as string) || "other";
  }

  // Extract system_prompt from agent_prompts (nested dict of dicts)
  const rawPrompts = raw.agent_prompts as Record<string, Record<string, unknown>> | undefined;
  if (rawPrompts) {
    const firstTaskPrompts = Object.values(rawPrompts)[0];
    if (typeof firstTaskPrompts?.system_prompt === "string") {
      systemPrompt = firstTaskPrompts.system_prompt;
    }
    const multilingual = firstTaskPrompts?.multilingual_prompts;
    if (multilingual && typeof multilingual === "object") {
      const prompts = multilingual as Record<string, { system_prompt: string; welcome_message?: string }>;
      agentConfig.persona = {
        system_prompt: systemPrompt || undefined,
        welcome_message: welcomeMessage || undefined,
        languages: Object.keys(prompts),
        multilingual_prompts: prompts,
      };
    } else if (systemPrompt || welcomeMessage) {
      agentConfig.persona = {
        system_prompt: systemPrompt || undefined,
        welcome_message: welcomeMessage || undefined,
      };
    }
  }

  // Phase A runtimes (spec 0028): top-level list on the stored record.
  // Read from the same nesting levels as everything else; absent stays
  // absent so old backends/records keep working.
  const rawChannels =
    (nestedData?.channels as unknown) ?? (raw.channels as unknown);
  const channels = Array.isArray(rawChannels)
    ? rawChannels.filter((c): c is string => typeof c === "string" && c.length > 0)
    : undefined;

  return {
    agent_id: agentId,
    agent_name: agentName,
    agent_type: agentType,
    agent_config: stripNulls(agentConfig),
    agent_prompts: {
      system_prompt: systemPrompt || undefined,
      welcome_message: welcomeMessage || undefined,
    },
    ...(channels && channels.length > 0 ? { channels } : {}),
  };
}

