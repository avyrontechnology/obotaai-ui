"use client";

import { useQueries } from "@tanstack/react-query";
import { useFormContext, useWatch, type Control, type UseFormRegister } from "react-hook-form";
import { SelectInput, TextInput, getFieldError } from "./form-controls";
import { agentChannelRejection, agentRequestErrors, apiClient } from "@/lib/api-client";
import { catalogKeys, useCatalogModels, useCatalogProviders, useCatalogVoices } from "@/services/platform/catalog";
import { catalogVoicesSchema, type CatalogModality, type CatalogVoice } from "@/lib/schemas/catalog";
import { useVoices } from "@/services/platform/voices";
import { cn } from "@/lib/utils";
import type { AgentData } from "@/lib/schemas/agent";
import type { CatalogModel } from "@/lib/schemas/catalog";

/** Builder dropdowns bound to the provider catalog (backend spec 0022/0023).
 *
 *  Rules (mirrored from the backend validator):
 *  - Closed rows must match exactly; `models_open` rows suggest one model in
 *    dropdowns but accept any non-empty string (free-text input + suggestions).
 *  - Voice gradual rule: rows without curated voices skip the check (free
 *    text); rows WITH voices require exact match unless `voices_open`.
 *  - Deprecated rows are hidden from dropdown payloads server-side; when the
 *    agent already uses one, keep it selectable (grandfather UX) with a badge.
 *  - Any catalog 404/network failure degrades to the legacy free-text inputs
 *    (feature-detect, never version-gate) so the builder works unmodified
 *    against old backends.
 */

export function CatalogProblems({
  problems,
  prefix,
}: {
  problems: string[];
  /** Match backend paths, e.g. "tasks[0].transcriber" — the backend walks
   *  every task, so match on the leaf (".transcriber") when task index is
   *  unknown client-side. */
  prefix: string;
}) {
  const relevant = problems.filter((p) => p.includes(prefix));
  if (relevant.length === 0) return null;
  return (
    <div
      role="alert"
      className="col-span-1 md:col-span-2 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-700 dark:text-red-400 space-y-1"
    >
      {relevant.map((problem) => (
        <p key={problem}>{problem}</p>
      ))}
    </div>
  );
}

/**
 * Top-level save-failure banner for agent create/update/PATCH (specs 0022+0028).
 * Field-specific `problems[]` render beside their inputs via CatalogProblems;
 * this covers everything else: channel allowlist rejections, 422 per-field
 * failures, and structural errors that carry no problems[] at all. Renders
 * nothing when field banners already cover the failure.
 */
export function AgentSaveBanner({ error, problems }: { error: unknown; problems: string[] }) {
  const channel = agentChannelRejection(error);
  const requestErrors = agentRequestErrors(error);
  let lines: string[] = [];
  if (channel && error instanceof Error) {
    // Message already names rejected + valid channels; keep it verbatim.
    lines = [error.message];
  } else if (requestErrors.length > 0) {
    lines = requestErrors;
  } else if (problems.length === 0 && error instanceof Error) {
    lines = [error.message];
  }
  if (lines.length === 0) return null;
  return (
    <div
      role="alert"
      className="rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-xs text-red-700 dark:text-red-400 space-y-1"
    >
      {lines.map((line) => (
        <p key={line}>{line}</p>
      ))}
    </div>
  );
}

function withCurrent(
  options: { label: string; value: string }[],
  current: string | undefined,
  badge: string
): { label: string; value: string }[] {
  if (!current || options.some((o) => o.value === current)) return options;
  return [...options, { label: `${current} ${badge}`, value: current }];
}

export function CatalogProviderField({
  name,
  label,
  modality,
  fallbackOptions,
  description,
  resetFields = [],
}: {
  name: string;
  label: string;
  modality: "asr" | "tts" | "s2s" | "llm";
  fallbackOptions: { label: string; value: string }[];
  description?: string;
  /** Dependent RHF paths cleared when the provider changes (cascade:
   *  provider→model→voice). Kills stale cross-provider combos — e.g. a
   *  Gemini provider with an OpenAI model — that 404 the catalog and fail
   *  write-time validation. Fires on discrete selection changes only. */
  resetFields?: string[];
}) {
  const { control, setValue } = useFormContext();
  const current = useWatch({ control, name }) as string | undefined;
  const { data: providers, isError, isLoading } = useCatalogProviders(modality);
  const cascade = () => {
    for (const path of resetFields) {
      setValue(path, undefined, { shouldDirty: true, shouldValidate: true });
    }
  };

  // Catalog unavailable (old backend 404, network): legacy static list.
  if (isError || (!isLoading && !providers)) {
    return <SelectInput name={name} label={label} options={fallbackOptions} description={description} onChange={cascade} />;
  }
  if (isLoading || !providers) {
    return <SelectInput name={name} label={label} options={fallbackOptions} description="Loading catalog…" onChange={cascade} />;
  }
  const options = withCurrent(
    providers.map((p) => ({
      label: p.deprecated ? `${p.provider} (deprecated)` : p.provider,
      value: p.provider,
    })),
    typeof current === "string" ? current : undefined,
    "(current)"
  );
  const liveHint = `Catalog · ${providers.length} providers${description ? ` — ${description}` : ""}`;
  return <SelectInput name={name} label={label} options={options} description={liveHint} onChange={cascade} />;
}

export function CatalogModelField({
  name,
  label,
  modality,
  providerField,
  placeholder,
  description,
  resetFields = [],
}: {
  name: string;
  label: string;
  modality: "asr" | "tts" | "s2s" | "llm";
  /** RHF path of the sibling provider select this model cascades from. */
  providerField: string;
  placeholder?: string;
  description?: string;
  /** Dependents cleared on discrete model-select changes (closed sets only —
   *  free-text inputs never reset, so typing can't wipe the voice). */
  resetFields?: string[];
}) {
  const { control, setValue } = useFormContext();
  const cascade = () => {
    for (const path of resetFields) {
      setValue(path, undefined, { shouldDirty: true, shouldValidate: true });
    }
  };
  const provider = useWatch({ control, name: providerField }) as string | undefined;
  const current = useWatch({ control, name }) as string | undefined;
  const { data: models, isError, isLoading } = useCatalogModels(modality, provider, !!provider);

  // No provider yet, or catalog unavailable: legacy free-text input.
  if (!provider || isError) {
    return <TextInput name={name} label={label} placeholder={placeholder} description={description} />;
  }
  if (isLoading || !models) {
    return <TextInput name={name} label={label} placeholder={placeholder} description="Loading catalog…" />;
  }
  const relevant = models.filter((m: CatalogModel) => m.provider === provider);
  if (relevant.length === 0) {
    return <TextInput name={name} label={label} placeholder={placeholder} description={description} />;
  }
  // Open namespace: free text with suggestions (never false-reject).
  const open = relevant.some((m) => m.models_open);
  if (open) {
    const suggested = relevant.map((m) => m.model).join(", ");
    return (
      <TextInput
        name={name}
        label={label}
        placeholder={placeholder}
        description={`${description ? `${description} ` : ""}Suggestions: ${suggested}`}
      />
    );
  }
  // Closed set: exact select, preserving a grandfathered current value.
  const options = withCurrent(
    relevant.map((m) => ({
      label: m.deprecated ? `${m.model} (deprecated)` : m.model,
      value: m.model,
    })),
    typeof current === "string" ? current : undefined,
    "(current)"
  );
  return <SelectInput name={name} label={label} options={options} description={description} onChange={cascade} />;
}

export function CatalogLanguageField({
  name,
  label,
  modality,
  providerField,
  placeholder = "e.g., en",
  description = "BCP-47 language code — any well-formed code validates",
}: {
  name: string;
  label: string;
  modality: "asr" | "tts" | "s2s" | "llm";
  providerField: string;
  placeholder?: string;
  description?: string;
}) {
  const { control } = useFormContext();
  const provider = useWatch({ control, name: providerField }) as string | undefined;
  const { data: models } = useCatalogModels(modality, provider, !!provider);
  const suggested = models
    ?.filter((m: CatalogModel) => m.provider === provider)
    .flatMap((m) => m.languages)
    .filter((v, i, arr) => arr.indexOf(v) === i);
  const hint =
    suggested && suggested.length > 0
      ? `${description} (suggestions: ${suggested.join(", ")})`
      : description;
  // Languages are always free BCP-47 input with suggestions (spec 0022:
  // codes are a standard, not provider folklore).
  return <TextInput name={name} label={label} placeholder={placeholder} description={hint} />;
}

/** Wizard-toolchain variant: plain `<select>` (no FormProvider needed) bound
 *  to the catalog with static-list fallback. Shows a "Catalog · N providers"
 *  caption when live so the binding is visible; silent fallback otherwise. */
export function WizardCatalogProviderSelect({
  control,
  register,
  name,
  modality,
  fallbackOptions,
  label,
  selectClassName,
  labelClassName,
  onSelect,
}: {
  control: Control<AgentData>;
  register: UseFormRegister<AgentData>;
  name: "agent_config.llm_provider" | "agent_config.asr_provider" | "agent_config.tts_provider" | "agent_config.s2s.provider";
  modality: "asr" | "tts" | "s2s" | "llm";
  fallbackOptions: { label: string; value: string }[];
  label: string;
  selectClassName: string;
  labelClassName: string;
  /** Cascade hook for wizard siblings without catalog bindings (e.g. clear
   *  the S2S model input when the realtime provider changes). */
  onSelect?: (value: string) => void;
}) {
  const current = useWatch({ control, name }) as string | undefined;
  const { data: providers, isError, isLoading } = useCatalogProviders(modality);
  const live = !isError && providers !== undefined;
  const base = live
    ? providers.map((p) => ({
        label: p.deprecated ? `${p.provider} (deprecated)` : p.provider,
        value: p.provider,
      }))
    : fallbackOptions;
  const options = withCurrent(base, typeof current === "string" ? current : undefined, "(current)");
  const registration = register(name);
  return (
    <div>
      <label className={labelClassName}>{label}</label>
      <select
        {...registration}
        className={selectClassName}
        aria-label={label}
        onChange={(event) => {
          void registration.onChange(event);
          onSelect?.(event.target.value);
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {live ? (
        <p className="text-[11px] font-mono text-muted-foreground mt-1.5">
          Catalog · {providers.length} providers{isLoading ? " (refreshing…)" : ""}
        </p>
      ) : null}
    </div>
  );
}

export function CatalogVoiceField({
  name,
  label,
  modality,
  providerField,
  modelField,
  agentId,
  providerIdField,
  voiceIdTargetField,
  placeholder = "e.g., Rachel",
  description = "Friendly name for the voice",
}: {
  name: string;
  label: string;
  modality: CatalogModality;
  providerField: string;
  modelField: string;
  /** When set, the agent's saved Voice Library unions into the dropdown, so
   *  providers without curated catalog voices (e.g. ElevenLabs) still offer
   *  a real-voice dropdown instead of a bare text input. */
  agentId?: string;
  /** TTS only: RHF path of the provider select, aligned on library picks
   *  (same as the Voice Library "Use" button). Omit for S2S. */
  providerIdField?: string;
  /** TTS only: RHF path of the provider voice-id input, filled on library picks. */
  voiceIdTargetField?: string;
  placeholder?: string;
  description?: string;
}) {
  const { control, register, setValue, getValues, formState: { errors } } = useFormContext();
  const provider = useWatch({ control, name: providerField }) as string | undefined;
  const model = useWatch({ control, name: modelField }) as string | undefined;
  const ready = !!provider && !!model;
  const exact = useCatalogVoices(provider ?? "", model ?? "", ready);
  // Provider-wide sweep: when the model is empty or doesn't match a catalog
  // row, the exact query is disabled/404 — fall back to unioning voices
  // across the provider's model rows so catalog voices still list. Runs only
  // on that fallback path; the happy path costs no extra request.
  const needSweep = !!provider && (!ready || exact.isError);
  const { data: providerModels } = useCatalogModels(modality, provider ?? "", needSweep);
  const sweep = useQueries({
    queries: (needSweep ? (providerModels ?? []) : []).map((row) => ({
      queryKey: catalogKeys.voices(row.provider, row.model),
      queryFn: async (): Promise<CatalogVoice[]> => {
        const params = new URLSearchParams({ provider: row.provider, model: row.model });
        const raw = await apiClient<unknown>(`/catalog/voices?${params.toString()}`);
        return catalogVoicesSchema.parse(raw);
      },
      staleTime: Infinity,
      retry: false,
    })),
  });
  // No agent (new unsaved records): skip the library query entirely.
  const { data: library } = useVoices(agentId, !!agentId);
  const current = useWatch({ control, name }) as string | undefined;
  const fieldError = getFieldError(errors as Record<string, unknown>, name);

  // Exact-row voices first (they carry sample URLs), then sweep rows.
  const seen = new Set<string>();
  const catalogVoices: CatalogVoice[] = [];
  for (const voice of [
    ...(ready && !exact.isError && exact.data ? exact.data : []),
    ...sweep.flatMap((result) => (result.isSuccess && result.data ? result.data : [])),
  ]) {
    if (!seen.has(voice.name)) {
      seen.add(voice.name);
      catalogVoices.push(voice);
    }
  }
  const libraryOnly = (library ?? []).filter((entry) => !seen.has(entry.name));
  const options = withCurrent(
    [
      // Gender comes from the curated seed (Gemini rows carry documented
      // genders; others stay name-only rather than guessed).
      ...catalogVoices.map((v) => ({
        label: v.gender ? `${v.name} · ${v.gender}` : v.name,
        value: v.name,
      })),
      ...libraryOnly.map((entry) => ({ label: `${entry.name} · library`, value: entry.name })),
    ],
    typeof current === "string" ? current : undefined,
    "(current)"
  );

  // Neither catalog nor library knows a voice here: free text, backend skips
  // the check silently (gradual rule — never false-reject).
  if (options.length === 0) {
    const emptyHint = !provider
      ? `${description} — set a provider above to list its catalog voices.`
      : description;
    return <TextInput name={name} label={label} placeholder={placeholder} description={emptyHint} />;
  }

  // A library pick carries its own provider + provider voice id — align them
  // like the Voice Library "Use" button so the save validates clean. Picks
  // without a library entry (catalog voices, free grandfathered values)
  // only set the name.
  const alignLibraryPick = (value: string) => {
    if (!agentId || !providerIdField) return;
    const entry = (library ?? []).find((item) => item.name === value);
    if (!entry) return;
    if (getValues(providerIdField) !== entry.provider) {
      setValue(providerIdField, entry.provider, { shouldDirty: true });
    }
    if (voiceIdTargetField && getValues(voiceIdTargetField) !== entry.provider_voice_id) {
      setValue(voiceIdTargetField, entry.provider_voice_id, { shouldDirty: true });
    }
  };

  const sample = catalogVoices.find((v) => v.name === current)?.sample_url ?? null;
  const liveHint = `Voices · ${catalogVoices.length} catalog${
    agentId ? ` + ${libraryOnly.length} library` : ""
  }${description ? ` — ${description}` : ""}`;
  return (
    <>
      <div className={cn("flex flex-col gap-2")}>
        <label htmlFor={name} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <div className="relative">
          <select
            {...register(name, {
              setValueAs: (value) => (value === "" ? undefined : value),
              onChange: (event) => alignLibraryPick(event.target.value),
            })}
            id={name}
            className="w-full appearance-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner"
          >
            <option value="">Select an option...</option>
            {options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-card text-foreground">
                {opt.label}
              </option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        {!fieldError && <p className="text-xs text-muted-foreground">{liveHint}</p>}
        {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
      </div>
      {sample ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">Sample</span>
          {/* Static sample playback only (spec 0023 non-goal: no synthesis preview). */}
          <audio controls preload="none" src={sample} className="w-full" aria-label={`Sample for voice ${current}`} />
        </div>
      ) : null}
    </>
  );
}
