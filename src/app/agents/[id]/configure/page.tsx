"use client";

import { use, useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAgent, useAgentPrompts, useUpdateAgent } from "@/services/api";
import { agentValidationProblems } from "@/lib/api-client";
import {
  Loader2,
  Save,
  ArrowLeft,
  PhoneCall,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { firstErrorMessage } from "@/components/settings/form-controls";
import { AgentSaveBanner } from "@/components/settings/catalog-fields";
import { ErrorState } from "@/components/common/error-state";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

import { TranscriberConfigForm } from "@/components/settings/transcriber-config";
import { SynthesizerConfigForm } from "@/components/settings/synthesizer-config";
import { LLMConfigForm } from "@/components/settings/llm-config";
import { RAGConfigForm } from "@/components/settings/rag-config";
import { CallBehaviorConfigForm } from "@/components/settings/call-behavior-config";
import { PersonaConfigForm } from "@/components/settings/persona-config";
import { ToolsConfigForm } from "@/components/settings/tools-config";
import { AnalyticsConfigForm } from "@/components/settings/analytics-config";
import { InboundConfigForm } from "@/components/settings/inbound-config";
import { useForm, FormProvider, useWatch } from "react-hook-form";
import { agentConfigSchema, AgentConfigData, type AgentData } from "@/lib/schemas/agent";
import { zodResolver } from "@hookform/resolvers/zod";
import { visibleGroupsFor, type SectionId } from "@/components/settings/sections";
import { ChannelSwitcher } from "@/components/settings/channel-config";
import { minRoleFor, useCan } from "@/lib/rbac";
import * as z from "zod";

// The settings sub-forms register fields under the `agent_config.*` prefix
// (e.g. `agent_config.llm.model`), so the form value must be shaped
// `{ agent_config: AgentConfigData }`. Flattening it here silently drops
// every edit: inputs read `values.agent_config.*` (undefined → empty) and
// the submit payload nests user input one level too deep, so
// toCreateAgentPayload falls back to defaults and the backend 200s without
// persisting anything.
//
// Form-root channel contract (Dev A writes, Dev B consumes):
// - `agent_type`: top-level RHF enum voice/text/s2s (staged type switch).
// - `channels`: top-level RHF string array (staged runtimes).
// Both default from the server record and fall back to it when untouched.
const configureFormSchema = z.object({
  agent_config: agentConfigSchema,
  agent_type: z.enum(["voice", "text", "s2s"]).optional(),
  channels: z.array(z.string()).optional(),
});
type ConfigureFormData = z.infer<typeof configureFormSchema>;

// Section metadata (grouping + per-type visibility) lives in
// components/settings/sections.ts. Ownership:
// - Core groups save via the global button → PUT /agent/:id.
// - Platform panels (tools, knowledge attach/vector, inbound/numbers,
//   webhooks) save independently to their own endpoints and state it inline.
export default function AgentConfigurePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Dedicated detail endpoint — never the list + .find().
  const { data: agent, isLoading, error, refetch } = useAgent(id);
  // Stored prompts live in a separate prompts file (GET /agent/:id/prompts).
  const { data: storedFilePrompts } = useAgentPrompts(id);
  const updateMutation = useUpdateAgent();

  const [activeSection, setActiveSection] = useState<SectionId>("persona");
  // Catalog write-time validation (spec 0022): backend 400s carry
  // error.details.problems[] with valid values — render beside the
  // offending select instead of a dead form. Never cleared implicitly;
  // the form keeps every valid input on failure (RHF preserves values).
  const [validationProblems, setValidationProblems] = useState<string[]>([]);
  const [saveError, setSaveError] = useState<unknown>(null);
  const canWrite = useCan("agents.write");

  // Merge the prompts file into persona so every field loads populated.
  // The record carries the greeting; the file carries the system prompt.
  const mergedConfig = useMemo<AgentConfigData | undefined>(() => {
    if (!agent) return undefined;
    const base = agent.agent_config;
    const languages = storedFilePrompts?.multilingual_prompts
      ? Object.keys(storedFilePrompts.multilingual_prompts)
      : base.persona?.languages;
    return {
      ...base,
      persona: {
        ...base.persona,
        system_prompt: storedFilePrompts?.system_prompt ?? base.persona?.system_prompt,
        welcome_message:
          storedFilePrompts?.welcome_message ??
          agent.agent_prompts.welcome_message ??
          base.persona?.welcome_message,
        languages,
        multilingual_prompts:
          storedFilePrompts?.multilingual_prompts ?? base.persona?.multilingual_prompts,
      },
    };
  }, [agent, storedFilePrompts]);

  const methods = useForm<ConfigureFormData>({
    resolver: zodResolver(configureFormSchema),
    defaultValues: {
      agent_config: mergedConfig ?? {},
      // Server record seeds the staged fields; the reset below fills them
      // once the record loads (first render has no agent yet).
      agent_type:
        agent?.agent_type === "voice" || agent?.agent_type === "text" || agent?.agent_type === "s2s"
          ? (agent.agent_type as "voice" | "text" | "s2s")
          : undefined,
      channels: agent?.channels,
    },
  });

  // Staged-type gating — stale-tabs-vs-teleport tradeoff (deliberate):
  // `groups`/`visibleIds` below stay on the SERVER record type so tabs never
  // disappear mid-edit. Teleporting the user to another tab on a staged type
  // switch loses form focus + scroll position and strands in-flight edits in
  // hidden sections (teleport loses). The header badge, Test deep-link, and
  // section `agentType` props follow the STAGED form type via `effectiveType`
  // so they preview what a save will produce. Pure derivation from useWatch
  // (staged) + server record (fallback when untouched) — no setState in any
  // effect (lint-forbidden cascade).
  const stagedAgentType = useWatch({ control: methods.control, name: "agent_type" });
  const effectiveType: string = stagedAgentType ?? agent?.agent_type ?? "";

  // Reset form when agent data is loaded (round-trips the top-level
  // agent_type/channels so Dev A's ChannelSwitcher stages them as form
  // state; submit falls back to stored values when untouched).
  useEffect(() => {
    if (mergedConfig && agent) {
      const storedType =
        agent.agent_type === "voice" || agent.agent_type === "text" || agent.agent_type === "s2s"
          ? (agent.agent_type as "voice" | "text" | "s2s")
          : undefined;
      methods.reset({
        agent_config: mergedConfig,
        agent_type: storedType,
        ...(agent.channels ? { channels: agent.channels } : {}),
      });
    }
  }, [mergedConfig, agent, methods]);

  // Sections are gated by the SERVER record type: an s2s record carries no
  // transcriber or llm blocks, so those tabs would render empty and silently
  // drop edits. Staged type intentionally does NOT regate tabs (see above).
  const groups = useMemo(() => visibleGroupsFor(agent?.agent_type ?? ""), [agent?.agent_type]);
  const visibleIds = useMemo(
    () => new Set(groups.flatMap((group) => group.sections.map((section) => section.id))),
    [groups]
  );

  // Clamp the active tab into the visible set as a pure derivation — no
  // setState in render (infinite re-render loop) and none in an effect
  // (lint-forbidden cascade). Tab clicks always target visible sections,
  // so activeSection only drifts while the agent record is still loading.
  const effectiveSection = visibleIds.has(activeSection)
    ? activeSection
    : (groups[0]?.sections[0]?.id ?? "persona");

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-muted-foreground gap-4 max-w-7xl mx-auto w-full pt-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <p className="font-mono text-sm animate-pulse">Loading agent configuration…</p>
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="max-w-7xl mx-auto w-full pt-6 md:pt-8 px-4">
        <ErrorState message="Failed to retrieve agent configuration" onRetry={() => refetch()}>
          <Link
            href="/agents"
            className="px-6 py-2.5 rounded-xl bg-card border border-border text-sm font-semibold hover:bg-accent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 inline-flex items-center justify-center"
          >
            Back to OboFleet
          </Link>
        </ErrorState>
      </div>
    );
  }

  // Global Save covers ONLY the core agent record → PUT /agent/:id,
  // which fully overwrites the record AND the prompts file.
  // Platform panels (tools/voices/KB/vector/inbound/webhooks) save to
  // their own endpoints via their own buttons inside each form.
  const onSubmit = async (data: ConfigureFormData) => {
    setValidationProblems([]);
    setSaveError(null);
    try {
      const config: AgentConfigData = data.agent_config;
      const persona = config.persona;
      const storedPrompts = agent.agent_prompts ?? {};
      const system_prompt =
        persona?.system_prompt ||
        storedFilePrompts?.system_prompt ||
        storedPrompts.system_prompt ||
        "You are a helpful AI assistant.";
      const welcome_message =
        persona?.welcome_message ??
        storedFilePrompts?.welcome_message ??
        storedPrompts.welcome_message;
      // Form-root staged values win; the stored record is the fallback when
      // the ChannelSwitcher was never touched (Dev A writes top-level
      // `agent_type` + `channels`; Dev B consumes AgentData.agent_type /
      // .channels in transforms). Phase A round-trip: PUT fully overwrites,
      // so re-emit (staged-or-stored) channels instead of the type default.
      // Cast: AgentData.agent_type is Dev A's tightened enum, but the stored
      // record can still carry legacy values ("other") that must round-trip
      // verbatim at runtime (Dev B's transform routes non-voice/s2s as text).
      const submitType = (data.agent_type ?? agent.agent_type) as AgentData["agent_type"];
      const submitChannels = data.channels ?? agent.channels;
      const fullData = {
        agent_name: agent.agent_name,
        agent_type: submitType,
        agent_prompts: {
          system_prompt,
          welcome_message,
        },
        agent_config: config,
        ...(submitChannels ? { channels: submitChannels } : {}),
      };
      await updateMutation.mutateAsync({ id, data: fullData });
      notify.success("Configuration saved", { description: agent.agent_name });
    } catch (e) {
      // Surface catalog problems verbatim beside their select; the toast
      // keeps the human-readable summary. The raw error is kept for the
      // top-level banner (channel/422/structural shapes carry no problems[]).
      setSaveError(e);
      setValidationProblems(agentValidationProblems(e));
      notify.error("Update failed", e);
    }
  };

  // Test deep-link follows the STAGED type (not just the saved record):
  // text stages preview chat, everything else previews talk. Pure
  // derivation — no setState, no effect.
  const testHref =
    effectiveType === "text"
      ? `/playground?agent=${id}&mode=chat`
      : `/playground?agent=${id}&mode=talk`;

  return (
    <div className="flex flex-col flex-1 min-h-full max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 sm:px-6">
      <Link
        href={`/agents/${id}`}
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200 mb-6 w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> {agent.agent_name} overview
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6 md:mb-8">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl md:text-3xl font-medium text-foreground tracking-tight text-balance" title={agent.agent_name}>
            Configure <span className="text-muted-foreground">{agent.agent_name}</span>{" "}
            <span data-testid="agent-type-badge" className="align-middle ml-1 px-3 py-1 rounded-full bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 text-xs font-mono font-normal">
              {effectiveType === "s2s" ? "Realtime" : effectiveType}
            </span>
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={testHref}
            className="flex items-center gap-2 px-5 h-11 rounded-2xl bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            <PhoneCall className="w-4 h-4" aria-hidden="true" /> Test
          </Link>
          <button
            onClick={methods.handleSubmit(
              onSubmit,
              (errors) =>
                notify.error("Cannot save yet", new Error(firstErrorMessage(errors as Record<string, unknown>)))
            )}
            disabled={updateMutation.isPending || !canWrite}
            title={canWrite ? undefined : `Requires ${minRoleFor("agents.write")} role`}
            className="flex items-center gap-2 px-6 h-11 rounded-2xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-50 shadow-lg shadow-primary/20 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Save className="w-4 h-4" aria-hidden="true" />}
            Save Configuration
          </button>
        </div>
      </div>

      <AgentSaveBanner error={saveError} problems={validationProblems} />

      <div className="flex flex-col lg:flex-row gap-8 items-start">
        {/* Grouped sidebar */}
        <aside className="w-full lg:w-72 shrink-0 flex flex-row lg:flex-col gap-5 lg:sticky lg:top-8 overflow-x-auto lg:overflow-visible custom-scrollbar pb-1 lg:pb-0" role="tablist" aria-label="Agent configuration groups">
          {groups.map((group) => (
            <div key={group.id} className="shrink-0 min-w-[220px] lg:min-w-0">
              <p className="px-4 mb-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
              <div className="flex flex-row lg:flex-col gap-1">
                {group.sections.map((section) => {
                  const isActive = effectiveSection === section.id;
                  const Icon = section.icon;
                  return (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      role="tab"
                      aria-selected={isActive}
                      aria-controls={`tab-panel-${section.id}`}
                      className="relative flex items-center gap-3 px-4 py-2.5 rounded-xl text-left transition-colors duration-200 group shrink-0 whitespace-nowrap w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
                    >
                      {isActive && (
                        <motion.div
                          layoutId="active-nav-indicator"
                          className="absolute inset-0 bg-muted rounded-xl border border-border"
                          transition={{ type: "spring", stiffness: 300, damping: 30 }}
                        />
                      )}
                      <Icon className={cn("w-4 h-4 relative z-10", isActive ? "text-ember-700 dark:text-ember-300" : "text-muted-foreground group-hover:text-foreground")} aria-hidden="true" />
                      <span className={cn("text-sm font-medium relative z-10", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")}>
                        {section.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        {/* Content Area */}
        <main
          className="relative flex-1 w-full min-h-[400px] lg:min-h-[500px] bg-card/40 backdrop-blur-xl border border-border rounded-3xl p-4 md:p-6 overflow-hidden"
          role="tabpanel"
          id={`tab-panel-${effectiveSection}`}
        >
          <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden rounded-3xl" aria-hidden="true">
            <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-secondary/40 blur-3xl" />
          </div>

          <div className="relative z-10">
            <FormProvider {...methods}>
              <AnimatePresence mode="wait">
                <motion.div
                  key={effectiveSection}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                >
                  {effectiveSection === "persona" && <PersonaConfigForm />}
                  {effectiveSection === "transcriber" && <TranscriberConfigForm problems={validationProblems} />}
                  {effectiveSection === "synthesizer" && <SynthesizerConfigForm agentId={id} agentType={effectiveType} problems={validationProblems} />}
                  {effectiveSection === "llm" && <LLMConfigForm problems={validationProblems} />}
                  {effectiveSection === "rag" && <RAGConfigForm agentId={id} />}
                  {effectiveSection === "behavior" && <CallBehaviorConfigForm />}
                  {effectiveSection === "tools" && <ToolsConfigForm agentId={id} problems={validationProblems} />}
                  {effectiveSection === "analytics" && <AnalyticsConfigForm agentId={id} />}
                  {effectiveSection === "inbound" && <InboundConfigForm agentId={id} />}
                  {/* Channel section (Dev A owns ChannelSwitcher; the
                      sections.ts "channel" entry makes this branch live). */}
                  {effectiveSection === "channel" && (
                    <ChannelSwitcher agentId={id} agentType={effectiveType} />
                  )}
                </motion.div>
              </AnimatePresence>
            </FormProvider>
          </div>
        </main>
      </div>

      <p className="sr-only">
        {groups.flatMap((group) => group.sections).map((s) => s.label).join(", ")}
      </p>
    </div>
  );
}
