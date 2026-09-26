"use client";

import { useState } from "react";
import { useFormContext, useWatch } from "react-hook-form";
import { CatalogProblems } from "./catalog-fields";
import { cn } from "@/lib/utils";

/** Agent types the switcher can stage. Unknown types render nothing. */
export type ChannelAgentType = "voice" | "text" | "s2s";

const TYPE_OPTIONS: { value: ChannelAgentType; title: string; hint: string }[] = [
  { value: "voice", title: "Voice", hint: "Realtime telephony & audio streams" },
  { value: "text", title: "Text", hint: "LLM chatbot for web and mobile widgets" },
  { value: "s2s", title: "Realtime S2S", hint: "Ultra low latency speech-to-speech" },
];

const CHANNEL_OPTIONS = [
  { value: "voice", title: "Voice", hint: "Telephony / audio runtime" },
  { value: "chat", title: "Chat", hint: "HTTP chat runtime" },
] as const;

export type AgentChannel = (typeof CHANNEL_OPTIONS)[number]["value"];

/**
 * Keep only the backend-accepted channel values (voice/chat), in canonical
 * voice→chat order, deduped. Anything else (stale/legacy entries) is dropped
 * so the allowlist never sees a rejected value.
 */
function normalizeChannels(value: unknown): AgentChannel[] {
  const list = Array.isArray(value) ? value : [];
  const kept = list.filter(
    (entry): entry is AgentChannel => entry === "voice" || entry === "chat"
  );
  return [...new Set(kept)];
}

function sameChannels(a: AgentChannel[], b: AgentChannel[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((entry) => b.includes(entry));
}

/**
 * Channel/type switcher — form state ONLY, never a PATCH.
 *
 * Contract (mirrors the PipelineToggle patterns in synthesizer-config.tsx):
 * - Writes exactly the form-root paths `agent_type` (string) and `channels`
 *   (string[]) via optimistic setValue ({ shouldDirty: true }) — Dev B reads
 *   `AgentData.agent_type` + `AgentData.channels`, Dev C owns submit/PATCH.
 * - `agent_type` is single-select (voice/text/s2s) via aria-pressed buttons in
 *   a labelled group; `channels` is multi-select (voice/chat) via real
 *   checkboxes. Both checked = hybrid ["voice","chat"].
 * - At-least-one invariant: unchecking the last channel is a no-op, so the
 *   form never emits [] (backend min_length=1 rejects it). Selections are
 *   always deduped.
 * - Staged-pending banner (role="status"): the server snapshot is captured
 *   ONCE at mount via useState initializers over getValues() — never setState
 *   in an effect — and compared against the live watched values. Any
 *   divergence stages the banner until Dev C's save remounts/resets the form.
 * - Dirty guard: unlike PipelineToggle (which disables PATCH flips while the
 *   form is dirty because its refetch resets the form), nothing here refetches
 *   or resets, so nothing is ever disabled. formState.isDirty is still read
 *   and surfaced in the staged copy so the pending-save state stays visible.
 * - Write-time validation lines for `.channels` render via CatalogProblems
 *   (role="alert" box when relevant problems exist).
 *
 * Renders null unless `agentType` is voice/text/s2s.
 */
export function ChannelSwitcher({
  agentId,
  agentType,
  problems = [],
}: {
  /** Server record id — informational here (scopes Dev C's PATCH wiring and
   *  E2E queries via data-agent-id); this component never fetches or PATCHes. */
  agentId?: string;
  /** Current record type; drives visibility only (unknown → null). */
  agentType: string;
  /** Write-time validation problems; `.channels` lines render in the alert box. */
  problems?: string[];
}) {
  const { control, setValue, getValues, formState } = useFormContext();
  const currentType = useWatch({ control, name: "agent_type" }) as string | undefined;
  const rawChannels = useWatch({ control, name: "channels" }) as unknown;

  // Server snapshot, captured once at mount via the state initializer —
  // never setState in an effect (lint-forbidden cascade).
  const [serverType] = useState(() => getValues("agent_type") as string | undefined);
  const [serverChannels] = useState(() => normalizeChannels(getValues("channels")));

  if (agentType !== "voice" && agentType !== "text" && agentType !== "s2s") return null;

  const selected = normalizeChannels(rawChannels);
  const dirty = formState.isDirty;

  const selectType = (value: ChannelAgentType) => {
    if (currentType === value) return;
    // Optimistic form sync only — Dev C's submit/PATCH persists it.
    setValue("agent_type", value, { shouldDirty: true, shouldValidate: true });
  };

  const toggleChannel = (value: AgentChannel) => {
    const next = new Set(selected);
    if (next.has(value)) {
      // At-least-one: unchecking the last channel is a no-op so the form
      // never stages [] (backend min_length=1 rejects it).
      if (next.size <= 1) return;
      next.delete(value);
    } else {
      next.add(value);
    }
    // Canonical voice→chat order, deduped, never [].
    const ordered = (["voice", "chat"] as const).filter((entry) => next.has(entry));
    setValue("channels", [...ordered], { shouldDirty: true, shouldValidate: true });
  };

  const typeStaged = currentType !== serverType;
  const channelsStaged = !sameChannels(selected, serverChannels);
  const staged = typeStaged || channelsStaged;

  const typeButton = (option: (typeof TYPE_OPTIONS)[number]) => {
    const active = currentType === option.value;
    return (
      <button
        key={option.value}
        type="button"
        onClick={() => selectType(option.value)}
        aria-pressed={active}
        aria-label={`${option.title} agent type${active ? " (active)" : ""}`}
        className={cn(
          "flex-1 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50",
          active
            ? "bg-primary/10 border-primary/40 text-foreground"
            : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
        )}
      >
        <span className="block text-sm font-semibold">{option.title}</span>
        <span className="block text-xs mt-0.5 opacity-80">{option.hint}</span>
      </button>
    );
  };

  return (
    <div
      className="col-span-1 md:col-span-2 flex flex-col gap-4 mb-2"
      {...(agentId ? { "data-agent-id": agentId } : {})}
    >
      <CatalogProblems problems={problems} prefix=".channels" />

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Agent type</span>
        <div className="flex gap-2" role="group" aria-label="Agent type">
          {TYPE_OPTIONS.map(typeButton)}
        </div>
        <p className="text-xs text-muted-foreground">
          Active: {currentType ?? "unset"} — staged to the form; saving persists it.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-foreground">Channels</span>
        <div className="flex gap-2" role="group" aria-label="Channels">
          {CHANNEL_OPTIONS.map((option) => {
            const checked = selected.includes(option.value);
            return (
              <label
                key={option.value}
                className={cn(
                  "flex-1 flex items-start gap-3 rounded-xl border px-4 py-3 text-left cursor-pointer transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-ember-400/50",
                  checked
                    ? "bg-primary/10 border-primary/40 text-foreground"
                    : "bg-muted/40 border-border text-muted-foreground hover:text-foreground hover:bg-muted/60"
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleChannel(option.value)}
                  aria-label={`${option.title} channel`}
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block text-sm font-semibold">{option.title}</span>
                  <span className="block text-xs mt-0.5 opacity-80">{option.hint}</span>
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Active channels: {selected.length > 0 ? selected.join(" + ") : "none"}
          {selected.length === 2 ? " (hybrid)" : ""} — at least one stays selected.
        </p>
      </div>

      {staged ? (
        <div
          role="status"
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 space-y-1"
        >
          <p>Staged changes pending save.</p>
          {typeStaged ? (
            <p>
              Type: {serverType ?? "unset"} → {currentType ?? "unset"}
            </p>
          ) : null}
          {channelsStaged ? (
            <p>
              Channels: {serverChannels.join(" + ") || "unset"} → {selected.join(" + ") || "unset"}
            </p>
          ) : null}
          {dirty ? <p>Save Configuration to apply.</p> : null}
        </div>
      ) : null}
    </div>
  );
}
