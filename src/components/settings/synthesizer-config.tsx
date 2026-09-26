import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { AudioLines, Loader2, Plus, Trash2 } from "lucide-react";
import { FormSection, TextInput, SelectInput, SwitchInput } from "./form-controls";
import {
  CatalogLanguageField,
  CatalogModelField,
  CatalogProblems,
  CatalogProviderField,
  CatalogVoiceField,
} from "./catalog-fields";
import { useCreateVoice, useDeleteVoice, useVoices } from "@/services/platform/voices";
import { usePatchAgent } from "@/services/api";
import { agentValidationProblems } from "@/lib/api-client";
import { notify } from "@/lib/notify";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

const TTS_PROVIDERS = [
  { label: "ElevenLabs", value: "elevenlabs" },
  { label: "Cartesia", value: "cartesia" },
  { label: "Deepgram", value: "deepgram" },
  { label: "OpenAI TTS", value: "openai" },
  { label: "Azure TTS", value: "azuretts" },
  { label: "AWS Polly", value: "polly" },
  { label: "Sarvam", value: "sarvam" },
  { label: "Smallest", value: "smallest" },
  { label: "Rime", value: "rime" },
  { label: "Maya", value: "maya" },
  { label: "Kalpa", value: "kalpa" },
  { label: "Pixa", value: "pixa" },
];


function VoiceLibrary({ agentId }: { agentId: string }) {
  const { setValue } = useFormContext();
  const { data: voices, isLoading } = useVoices(agentId);
  const createVoice = useCreateVoice();
  const deleteVoice = useDeleteVoice();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("elevenlabs");
  const [providerVoiceId, setProviderVoiceId] = useState("");
  const [source, setSource] = useState("provider");
  const [formError, setFormError] = useState<string | null>(null);

  const handleCreate = async () => {
    setFormError(null);
    if (!name.trim() || !providerVoiceId.trim()) {
      setFormError("Name and provider voice ID are required.");
      return;
    }
    try {
      await createVoice.mutateAsync({
        agent_id: agentId,
        name: name.trim(),
        provider,
        provider_voice_id: providerVoiceId.trim(),
        source: source as "provider" | "cloned" | "imported",
      });
      setName("");
      setProviderVoiceId("");
      setShowForm(false);
    } catch (e) {
      // Spec 0025 validates provider (catalog) + language (BCP-47) server-side:
      // surface the backend message (it carries the valid values) instead of
      // the generic connectivity hint.
      setFormError(e instanceof Error ? e.message : "Could not save the voice. Is the backend running?");
    }
  };

  return (
    <div className="col-span-1 md:col-span-2 space-y-3">
      {isLoading ? (
        <div className="h-16 rounded-2xl bg-muted/50 animate-pulse" />
      ) : (voices ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-5 text-center">
          No saved voices. Add provider, cloned or imported voice IDs here, then apply them in one click.
        </p>
      ) : (
        (voices ?? []).map((voice) => (
          <div
            key={voice.voice_id}
            className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-3"
          >
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <AudioLines className="w-4 h-4 text-ember-700 dark:text-ember-300" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{voice.name}</p>
              <p className="text-xs font-mono text-muted-foreground truncate">
                {voice.provider} · {voice.provider_voice_id} · {voice.source}
              </p>
            </div>
            <button
              onClick={() => {
                setValue("agent_config.synthesizer.provider", voice.provider, { shouldDirty: true });
                setValue("agent_config.synthesizer.voice", voice.name, { shouldDirty: true });
                setValue("agent_config.synthesizer.voice_id", voice.provider_voice_id, { shouldDirty: true });
              }}
              className="h-9 px-3 rounded-xl text-xs font-semibold bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              Use
            </button>
            <button
              onClick={() => void deleteVoice.mutateAsync(voice.voice_id)}
              aria-label={`Delete ${voice.name}`}
              className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))
      )}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-11 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> Add voice
        </button>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" aria-label="Voice display name" className={fieldStyles.fieldSm} />
            <input value={providerVoiceId} onChange={(e) => setProviderVoiceId(e.target.value)} placeholder="Provider voice ID" aria-label="Provider voice ID" className={cn(fieldStyles.fieldSm, "font-mono text-xs")} />
            <select value={provider} onChange={(e) => setProvider(e.target.value)} aria-label="Voice provider" className={fieldStyles.fieldSm}>
              {TTS_PROVIDERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Voice source" className={fieldStyles.fieldSm}>
              <option value="provider">Provider stock</option>
              <option value="cloned">Cloned (via provider console)</option>
              <option value="imported">Imported</option>
            </select>
          </div>
          <p className="text-xs text-muted-foreground">
            Cloning itself happens in the provider console (ElevenLabs, Cartesia…); paste the resulting voice ID here.
          </p>
          {formError && <p className="text-xs text-red-700 dark:text-red-400">{formError}</p>}
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              disabled={createVoice.isPending}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {createVoice.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Save voice
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              className="h-10 px-4 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Phase A engine toggle (spec 0028): flips the per-task `pipeline` pointer
 * between the coexisting ASR (transcriber/LLM/TTS) and realtime (S2S) blocks
 * via PATCH `tasks_patch` — no full-form resend, no extraction regen beyond
 * changed tasks. The parked side is kept, never wiped — both blocks persist
 * and validate. Untouched toggle (undefined) preserves legacy inference.
 *
 * Data-loss guard: flipping refetches the record and resets the form, so the
 * toggle stays disabled while the form holds unsaved edits. Without an
 * agentId (unsaved record) it falls back to form state, saved via PUT.
 */
export function PipelineToggle({ agentId, agentType }: { agentId?: string; agentType: string }) {
  const { control, setValue, formState } = useFormContext();
  const stored = useWatch({ control, name: "agent_config.pipeline" }) as "asr" | "s2s" | "chat" | undefined;
  const s2sPresent = useWatch({ control, name: "agent_config.s2s" }) as unknown;
  const patch = usePatchAgent();
  const [flipError, setFlipError] = useState<unknown>(null);
  if (agentType !== "voice" && agentType !== "s2s") return null;
  // Effective routing mirrors backend inference (resolve_pipeline_for_task):
  // explicit asr|s2s wins, else an s2s block means realtime, else ASR. A
  // stored "chat" pointer (Phase C forward-compat) is shown neutrally — the
  // toggle only deals in asr|s2s and never overwrites what it can't serve.
  const recognized = stored === "asr" || stored === "s2s";
  const effective = recognized ? stored : s2sPresent ? "s2s" : "asr";
  // Pressed state follows the stored pointer verbatim when one exists —
  // including "chat", which presses nothing (neutral) — else the inference.
  const isActive = (value: "asr" | "s2s") => (stored === undefined ? effective === value : stored === value);
  // UI invariant: the transform emits a single task, so index 0 addresses it.
  const flipping = patch.isPending;
  // The guard only matters for PATCH flips (refetch resets the form). The
  // form-state fallback rewrites nothing else, so it stays always available.
  const blocked = !!agentId && formState.isDirty;

  const flip = async (value: "asr" | "s2s") => {
    if (isActive(value)) return;
    setFlipError(null);
    if (!agentId) {
      setValue("agent_config.pipeline", value, { shouldDirty: true, shouldValidate: true });
      return;
    }
    // Optimistic form sync first (refetch converges on the same value after
    // invalidation); other dirty fields are protected by the guard above.
    setValue("agent_config.pipeline", value, { shouldDirty: false, shouldValidate: true });
    try {
      await patch.mutateAsync({ id: agentId, patch: { tasks_patch: [{ task_index: 0, pipeline: value }] } });
    } catch (e) {
      setFlipError(e);
      notify.error("Pipeline flip failed", e);
    }
  };

  const flipProblems = agentValidationProblems(flipError);

  const option = (value: "asr" | "s2s", title: string, hint: string) => {
    const active = isActive(value);
    return (
      <button
        type="button"
        onClick={() => void flip(value)}
        disabled={flipping || blocked}
        aria-pressed={active}
        aria-label={`${title} pipeline${active ? " (active)" : ""}`}
        title={blocked ? "Save or discard form edits before flipping the engine" : undefined}
        className={cn(
          "flex-1 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 disabled:opacity-50",
          active
            ? "bg-primary/10 border-primary/40 text-foreground"
            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        <span className="block text-sm font-semibold">
          {title} {flipping && !active ? "…" : ""}
        </span>
        <span className="block text-xs mt-0.5 opacity-80">{hint}</span>
      </button>
    );
  };

  return (
    <div className="col-span-1 md:col-span-2 flex flex-col gap-2 mb-2">
      <span className="text-sm font-medium text-foreground">Engine pipeline</span>
      <div className="flex gap-2" role="group" aria-label="Engine pipeline">
        {option("asr", "ASR pipeline", "Transcriber → LLM → TTS")}
        {option("s2s", "Realtime (S2S)", "Direct speech-to-speech")}
      </div>
      <p className="text-xs text-muted-foreground">
        {stored === "chat" ? (
          <>
            Active: chat (explicit) — managed outside this toggle; flipping sets an asr|s2s pointer.
          </>
        ) : (
          <>
            Active: {effective === "asr" ? "ASR pipeline" : "Realtime (S2S)"}
            {stored ? " (explicit)" : " (inferred)"} — the other side stays saved as parked config.
          </>
        )}
        {blocked ? " Save or discard edits to flip." : ""}
      </p>
      {flipError ? (
        <div
          role="alert"
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-700 dark:text-red-400 space-y-1"
        >
          {(flipProblems.length > 0
            ? flipProblems
            : [flipError instanceof Error ? flipError.message : "Pipeline flip failed."]).map(
            (line) => (
              <p key={line}>{line}</p>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}

export function SynthesizerConfigForm({
  agentId,
  agentType = "voice",
  problems = [],
}: {
  agentId?: string;
  /** Voice agents use discrete TTS; s2s agents use the realtime block only. */
  agentType?: string;
  problems?: string[];
}) {
  const { watch } = useFormContext();
  const s2sProvider = watch("agent_config.s2s.provider") as string | undefined;
  const isGeminiS2S = s2sProvider === "gemini_live";
  const isS2S = agentType === "s2s";
  return (
    <div className="space-y-10">
      <FormSection
        title="Engine"
        description="Which pipeline runs live calls. Both sides stay saved; the parked side keeps validating."
      >
        <CatalogProblems problems={problems} prefix=".pipeline" />
        <PipelineToggle agentId={agentId} agentType={agentType} />
      </FormSection>
      {!isS2S && (
        <>
      <FormSection
        title="Core Settings"
        description="Configure the text-to-speech provider and primary voice settings."
      >
        <CatalogProblems problems={problems} prefix=".synthesizer" />
        <CatalogProviderField
          name="agent_config.synthesizer.provider"
          label="Provider"
          modality="tts"
          fallbackOptions={TTS_PROVIDERS}
          resetFields={[
            "agent_config.synthesizer.model",
            "agent_config.synthesizer.voice",
            "agent_config.synthesizer.voice_id",
          ]}
        />
        <CatalogModelField
          name="agent_config.synthesizer.model"
          label="Model"
          modality="tts"
          providerField="agent_config.synthesizer.provider"
          placeholder="e.g., eleven_multilingual_v2"
          description="Specific model version (Polly resolves its engine instead)"
          resetFields={["agent_config.synthesizer.voice"]}
        />
        <CatalogVoiceField
          name="agent_config.synthesizer.voice"
          label="Voice Name"
          modality="tts"
          providerField="agent_config.synthesizer.provider"
          modelField="agent_config.synthesizer.model"
          agentId={agentId}
          providerIdField="agent_config.synthesizer.provider"
          voiceIdTargetField="agent_config.synthesizer.voice_id"
          placeholder="e.g., Rachel"
          description="Friendly name for the voice"
        />
        <CatalogLanguageField
          name="agent_config.synthesizer.language"
          label="Language"
          modality="tts"
          providerField="agent_config.synthesizer.provider"
          placeholder="e.g., en"
        />
        <TextInput
          name="agent_config.synthesizer.voice_id"
          label="Voice ID"
          placeholder="Provider specific Voice ID"
          description="Exact ID required by the provider APIs"
        />
      </FormSection>

      <FormSection
        title="Expression & Style"
        description="Fine-tune how the synthesized voice sounds (provider dependent)."
      >
        <TextInput
          name="agent_config.synthesizer.temperature"
          label="Temperature"
          type="number"
          placeholder="0.5"
          description="Higher values make voice more expressive/random (0.0 - 2.0)"
        />
        <TextInput
          name="agent_config.synthesizer.similarity_boost"
          label="Similarity Boost"
          type="number"
          placeholder="0.75"
          description="How much the AI matches the original voice (0.0 - 1.0)"
        />
        <TextInput
          name="agent_config.synthesizer.style"
          label="Style Emphasis"
          type="number"
          placeholder="0.0"
          description="Degree of style exaggeration (for supported providers)"
        />
        <TextInput
          name="agent_config.synthesizer.speed"
          label="Speech Speed"
          type="number"
          placeholder="1.0"
          description="Playback multiplier (e.g., 1.0 is normal, 1.2 is fast)"
        />
      </FormSection>

      <FormSection
        title="Performance & Format"
        description="Optimization settings for audio delivery."
      >
        <SelectInput
          name="agent_config.synthesizer.audio_format"
          label="Audio Format"
          options={[
            { label: "MP3", value: "mp3" },
            { label: "PCM (Linear16)", value: "pcm" },
            { label: "Opus", value: "opus" },
            { label: "MuLaw", value: "mulaw" },
          ]}
        />
        <TextInput
          name="agent_config.synthesizer.buffer_size"
          label="Buffer Size"
          type="number"
          placeholder="40"
          description="Audio chunk buffer size"
        />
        <SwitchInput
          name="agent_config.synthesizer.stream"
          label="Streaming Audio"
          description="Deliver audio chunks in real-time as they are synthesized."
        />
        <SwitchInput
          name="agent_config.synthesizer.caching"
          label="Response Caching"
          description="Cache audio for identical text outputs to reduce latency."
        />
      </FormSection>

      <FormSection
        title="Voice Library"
        description="Saved voices for this agent. Applying one fills the provider fields above."
      >
        {agentId ? (
          <VoiceLibrary agentId={agentId} />
        ) : (
          <p className="col-span-1 md:col-span-2 text-sm text-muted-foreground">
            Save the agent first to build its voice library.
          </p>
        )}
      </FormSection>
        </>
      )}

      {isS2S && (
      <FormSection
        title="Realtime (S2S)"
        description="Realtime speech-to-speech settings. Only used by Realtime agents — the separate voice and language steps are skipped."
      >
        <CatalogProblems problems={problems} prefix=".s2s" />
        <CatalogProviderField
          name="agent_config.s2s.provider"
          label="S2S Provider"
          modality="s2s"
          fallbackOptions={[
            { label: "OpenAI Realtime", value: "openai_realtime" },
            { label: "Gemini Live", value: "gemini_live" },
          ]}
          resetFields={["agent_config.s2s.model", "agent_config.s2s.voice"]}
        />
        <CatalogModelField
          name="agent_config.s2s.model"
          label="Model"
          modality="s2s"
          providerField="agent_config.s2s.provider"
          placeholder="e.g., gpt-realtime-2.1"
          resetFields={["agent_config.s2s.voice"]}
        />
        <CatalogVoiceField
          name="agent_config.s2s.voice"
          label="Voice"
          modality="s2s"
          providerField="agent_config.s2s.provider"
          modelField="agent_config.s2s.model"
          agentId={agentId}
          placeholder="e.g., marin, Kore"
        />
        <TextInput
          name="agent_config.s2s.language"
          label="Language"
          placeholder="e.g., en"
          description="Language constraint for the session (optional)"
        />
        <TextInput
          name="agent_config.s2s.vad_silence_duration_ms"
          label="VAD Silence (ms)"
          type="number"
          placeholder="500"
        />
        <TextInput
          name="agent_config.s2s.vad_prefix_padding_ms"
          label="VAD Prefix Padding (ms)"
          type="number"
          placeholder="300"
        />
        <TextInput
          name="agent_config.s2s.welcome_audio_gate_ms"
          label="Welcome Audio Gate (ms)"
          type="number"
          placeholder="1500"
          description="Suppress inbound audio at connection start so the greeting can't trip VAD"
        />
        {!isGeminiS2S && (
          <>
            <TextInput
              name="agent_config.s2s.speed"
              label="Speed"
              type="number"
              placeholder="1.0"
              description="Playback rate, 0.25 to 1.5"
            />
            <SelectInput
              name="agent_config.s2s.turn_detection_type"
              label="Turn Detection"
              options={[
                { label: "Semantic VAD", value: "semantic_vad" },
                { label: "Server VAD", value: "server_vad" },
              ]}
            />
            <SelectInput
              name="agent_config.s2s.eagerness"
              label="Eagerness"
              options={[
                { label: "Auto", value: "auto" },
                { label: "Low", value: "low" },
                { label: "Medium", value: "medium" },
                { label: "High", value: "high" },
              ]}
            />
            <TextInput
              name="agent_config.s2s.vad_threshold"
              label="VAD Threshold"
              type="number"
              placeholder="0.5"
              description="Server VAD only, 0.0 to 1.0"
            />
            <TextInput
              name="agent_config.s2s.transcription_model"
              label="Transcription Model"
              placeholder="gpt-4o-mini-transcribe"
            />
            <TextInput
              name="agent_config.s2s.max_output_tokens"
              label="Max Output Tokens"
              type="number"
              placeholder="Unlimited when empty"
            />
            <SelectInput
              name="agent_config.s2s.reasoning_effort"
              label="Reasoning Effort"
              options={[
                { label: "Low", value: "low" },
                { label: "Medium", value: "medium" },
                { label: "High", value: "high" },
              ]}
              description="Only for reasoning-capable realtime models"
            />
          </>
        )}
        {isGeminiS2S && (
          <>
            <TextInput
              name="agent_config.s2s.temperature"
              label="Temperature"
              type="number"
              placeholder="1.0"
            />
            <TextInput
              name="agent_config.s2s.start_sensitivity"
              label="Start Sensitivity"
              placeholder="e.g., high"
            />
            <TextInput
              name="agent_config.s2s.end_sensitivity"
              label="End Sensitivity"
              placeholder="e.g., high"
            />
            <SwitchInput
              name="agent_config.s2s.enable_session_resumption"
              label="Session Resumption"
              description="Recover gracefully when Gemini closes an audio session (~15 min)"
            />
            <SwitchInput
              name="agent_config.s2s.enable_context_compression"
              label="Context Compression"
              description="Compress context to save tokens over long sessions"
            />
          </>
        )}
      </FormSection>
      )}
    </div>
  );
}
