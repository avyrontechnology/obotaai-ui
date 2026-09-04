import * as z from "zod";

export const transcriberSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  model: z.string().optional(),
  language: z.string().optional(),
  stream: z.boolean().optional(),
  sampling_rate: z.number().int().optional(),
  encoding: z.string().optional(),
  endpointing: z.number().int().optional(),
  keywords: z.string().optional(),
  noise_reduction: z.boolean().optional(),
  vad_threshold: z.number().min(0).max(1).optional(),
  vad_prefix_padding_ms: z.number().int().optional(),
  eot_threshold: z.number().optional(),
  eager_eot_threshold: z.number().optional(),
  eot_timeout_ms: z.number().int().optional(),
});

export const synthesizerSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  stream: z.boolean().optional(),
  buffer_size: z.number().int().optional(),
  audio_format: z.string().optional(),
  caching: z.boolean().optional(),
  // Provider specifics
  voice: z.string().optional(),
  voice_id: z.string().optional(),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  similarity_boost: z.number().min(0).max(1).optional(),
  speed: z.number().optional(),
  style: z.number().optional(),
  engine: z.string().optional(),
  language: z.string().optional(),
  top_p: z.number().min(0).max(1).optional(),
  repetition_penalty: z.number().optional(),
  acoustic_temperature: z.number().optional(),
  audio_quality: z.string().optional(),
  max_new_tokens: z.number().int().optional(),
});

export const llmSchema = z.object({
  provider: z.string().min(1, "Provider is required"),
  model: z.string().min(1, "Model is required"),
  max_tokens: z.number().int().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_k: z.number().int().optional(),
  top_p: z.number().min(0).max(1).optional(),
  min_p: z.number().min(0).max(1).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  request_json: z.boolean().optional(),
  reasoning_effort: z.enum(["low", "medium", "high"]).optional(),
  // Backend Llm/SimpleLlmAgent extras with no UI controls. PUT overwrites
  // the whole record, so they round-trip here instead of being wiped.
  stop: z.array(z.string()).optional(),
  base_url: z.string().optional(),
  verbosity: z.string().optional(),
  use_responses_api: z.boolean().optional(),
  compact_threshold: z.number().int().optional(),
  agent_flow_type: z.string().optional(),
  extraction_details: z.string().optional(),
  summarization_details: z.string().optional(),
});

export const ragSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.string().optional(),
  connection_string: z.string().optional(),
  db_name: z.string().optional(),
  collection_name: z.string().optional(),
  index_name: z.string().optional(),
  embedding_model: z.string().optional(),
  embedding_dimensions: z.number().int().optional(),
  vector_id: z.string().optional(),
  similarity_top_k: z.number().int().optional(),
  score_threshold: z.number().min(0).max(1).optional(),
  reranker_enabled: z.boolean().optional(),
  reranker_model_type: z.string().optional(),
  candidate_count: z.number().int().optional(),
  final_count: z.number().int().optional(),
});

export const conversationSchema = z.object({
  optimize_latency: z.boolean().optional(),
  incremental_delay: z.number().int().optional(),
  ambient_noise: z.boolean().optional(),
  use_fillers: z.boolean().optional(),
  backchanneling: z.boolean().optional(),
  backchanneling_message_gap: z.number().int().optional(),
  backchanneling_start_delay: z.number().int().optional(),
  hangup_after_silence: z.number().int().optional(),
  number_of_words_for_interruption: z.number().int().optional(),
  interruption_backoff_period: z.number().int().optional(),
  check_if_user_online: z.boolean().optional(),
  trigger_user_online_message_after: z.number().int().optional(),
  check_user_online_message: z.string().optional(),
  voicemail: z.boolean().optional(),
  voicemail_detection_duration: z.number().optional(),
  voicemail_check_interval: z.number().optional(),
  voicemail_min_transcript_length: z.number().int().optional(),
  dtmf_enabled: z.boolean().optional(),
  call_terminate: z.number().int().optional(),
  hangup_after_LLMCall: z.boolean().optional(),
  call_cancellation_prompt: z.string().optional(),
});

export const telephonySchema = z.object({
  input_provider: z.string().optional(),
  input_format: z.string().optional(),
  output_provider: z.string().optional(),
  output_format: z.string().optional(),
});

export const multilingualPromptSchema = z.object({
  system_prompt: z.string(),
  welcome_message: z.string().optional(),
});

export const personaSchema = z.object({
  system_prompt: z.string().optional(),
  welcome_message: z.string().optional(),
  languages: z.array(z.string()).optional(),
  multilingual_prompts: z.record(z.string(), multilingualPromptSchema).optional(),
});

/**
 * Mirrors the backend S2S provider configs (voiceai/models.py):
 * OpenAIRealtimeConfig + GeminiLiveConfig, plus the S2S-level
 * welcome_audio_gate_ms. PUT overwrites the whole agent record, so every
 * field the backend persists must be present here or a save wipes it.
 */
export const s2sSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  voice: z.string().optional(),
  language: z.string().optional(),
  // Shared VAD
  vad_silence_duration_ms: z.number().int().optional(),
  vad_prefix_padding_ms: z.number().int().optional(),
  // S2S-level (applies to every provider)
  welcome_audio_gate_ms: z.number().int().optional(),
  // OpenAI Realtime
  speed: z.number().min(0.25).max(1.5).optional(),
  turn_detection_type: z.string().optional(),
  eagerness: z.string().optional(),
  vad_threshold: z.number().min(0).max(1).optional(),
  reasoning_effort: z.enum(["low", "medium", "high"]).optional(),
  max_output_tokens: z.number().int().optional(),
  transcription_model: z.string().optional(),
  // Gemini Live
  temperature: z.number().min(0).max(2).optional(),
  start_sensitivity: z.string().optional(),
  end_sensitivity: z.string().optional(),
  enable_session_resumption: z.boolean().optional(),
  enable_context_compression: z.boolean().optional(),
});

export const agentConfigSchema = z.object({
  transcriber: transcriberSchema.optional(),
  synthesizer: synthesizerSchema.optional(),
  llm: llmSchema.optional(),
  rag: ragSchema.optional(),
  conversation: conversationSchema.optional(),
  telephony: telephonySchema.optional(),
  persona: personaSchema.optional(),
  s2s: s2sSchema.optional(),
  // Legacy mappings for the wizard
  llm_provider: z.string().optional(),
  asr_provider: z.string().optional(),
  tts_provider: z.string().optional(),
});

export const agentSchema = z.object({
  agent_name: z.string().min(2, "Name must be at least 2 characters"),
  agent_type: z.string(),
  agent_prompts: z.object({
    system_prompt: z.string().min(10, "System prompt must be at least 10 characters"),
    welcome_message: z.string().optional(),
  }),
  agent_config: agentConfigSchema,
});

export type TranscriberConfig = z.infer<typeof transcriberSchema>;
export type SynthesizerConfig = z.infer<typeof synthesizerSchema>;
export type LLMConfig = z.infer<typeof llmSchema>;
export type RagConfig = z.infer<typeof ragSchema>;
export type ConversationConfig = z.infer<typeof conversationSchema>;
export type TelephonyConfig = z.infer<typeof telephonySchema>;
export type PersonaConfig = z.infer<typeof personaSchema>;
export type S2SConfig = z.infer<typeof s2sSchema>;
export type AgentConfigData = z.infer<typeof agentConfigSchema>;
export type AgentData = z.infer<typeof agentSchema>;
