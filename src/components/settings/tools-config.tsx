"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, PhoneForwarded, CalendarClock, Braces, Clock3, Plus, Trash2 } from "lucide-react";
import { FormSection } from "./form-controls";
import { useAgentTools, useCreateAgentTool, useDeleteAgentTool } from "@/services/platform/tools";
import type { AgentTool } from "@/lib/schemas/platform";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

const KIND_META = {
  transfer: { label: "Call Transfer", icon: PhoneForwarded, hint: "Hand the call to a human or endpoint." },
  calendar: { label: "Calendar", icon: CalendarClock, hint: "Check and book slots via Cal.com." },
  custom: { label: "Custom Function", icon: Braces, hint: "Call any external API mid-conversation." },
  datetime: { label: "Date & Time", icon: Clock3, hint: "Resolve the current time in any timezone." },
} as const;

type Kind = keyof typeof KIND_META;


function KindFields({ kind, draft, setDraft }: {
  kind: Kind;
  draft: Record<string, string>;
  setDraft: (patch: Record<string, string>) => void;
}) {
  const set = (key: string) => ({
    value: draft[key] ?? "",
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft({ [key]: event.target.value }),
  });
  if (kind === "transfer") {
    return (
      <>
        <input {...set("target")} placeholder="+911234567890" aria-label="Transfer target" className={fieldStyles.field} />
        <input {...set("handoff_message")} placeholder="Connecting you to a specialist…" aria-label="Handoff message" className={fieldStyles.field} />
      </>
    );
  }
  if (kind === "calendar") {
    return (
      <>
        <input {...set("api_key")} placeholder="Cal.com API key" aria-label="Calendar API key" className={fieldStyles.field} />
        <input {...set("event_type_id")} placeholder="Event type id" aria-label="Calendar event type" className={fieldStyles.field} />
      </>
    );
  }
  if (kind === "datetime") {
    return (
      <input {...set("timezone")} placeholder="Asia/Kolkata" aria-label="Timezone" className={fieldStyles.field} />
    );
  }
  return (
    <>
      <input {...set("description")} placeholder="What this function does" aria-label="Function description" className={fieldStyles.field} />
      <div className="grid grid-cols-3 gap-2">
        <input {...set("endpoint")} placeholder="https://api/…" aria-label="Endpoint URL" className={cn(fieldStyles.field, "col-span-2 font-mono text-xs")} />
        <select {...set("method")} aria-label="HTTP method" className={cn(fieldStyles.field, "font-mono text-xs")}>
          <option value="POST">POST</option>
          <option value="GET">GET</option>
        </select>
      </div>
      <textarea
        {...set("parameters")}
        rows={3}
        placeholder='Parameters JSON schema, e.g. {"type":"object","properties":{}}'
        aria-label="Parameters JSON schema"
        className="w-full bg-card border border-border rounded-2xl px-4 py-2.5 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 resize-y"
      />
    </>
  );
}

export function ToolsConfigForm({ agentId }: { agentId: string }) {
  const { data: tools, isLoading } = useAgentTools(agentId);
  const createTool = useCreateAgentTool();
  const deleteTool = useDeleteAgentTool();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<Kind>("transfer");
  const [draft, setDraftState] = useState<Record<string, string>>({ method: "POST" });
  const [formError, setFormError] = useState<string | null>(null);

  const setDraft = (patch: Record<string, string>) => setDraftState((prev) => ({ ...prev, ...patch }));

  const buildConfig = (): Record<string, unknown> => {
    if (kind === "transfer") return { target: draft.target?.trim(), handoff_message: draft.handoff_message?.trim() || undefined };
    if (kind === "calendar") return { provider: "cal.com", api_key: draft.api_key?.trim(), event_type_id: draft.event_type_id?.trim() };
    if (kind === "datetime") return { timezone: draft.timezone?.trim() || "Asia/Kolkata" };
    return {
      description: draft.description?.trim(),
      endpoint: draft.endpoint?.trim(),
      method: draft.method || "POST",
      parameters: draft.parameters?.trim() ? JSON.parse(draft.parameters) : {},
    };
  };

  const handleCreate = async () => {
    setFormError(null);
    if (!name.trim()) {
      setFormError("Give the tool a name.");
      return;
    }
    let config: Record<string, unknown>;
    try {
      config = buildConfig();
    } catch {
      setFormError("Parameters must be valid JSON.");
      return;
    }
    try {
      await createTool.mutateAsync({ agent_id: agentId, name: name.trim(), kind, config });
      setName("");
      setDraftState({ method: "POST" });
      setShowForm(false);
    } catch {
      setFormError("Could not create the tool. Is the backend running?");
    }
  };

  return (
    <div className="space-y-10">
      <FormSection
        title="Function Tools"
        description="Tools the agent can invoke mid-call. Stored in the platform registry for this agent."
      >
        <div className="col-span-1 md:col-span-2 space-y-3">
          {isLoading ? (
            <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
          ) : (tools ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">
              No tools yet. Add a transfer, calendar, custom API or date/time tool below.
            </p>
          ) : (
            (tools as AgentTool[]).map((tool) => {
              const meta = KIND_META[tool.kind];
              const Icon = meta.icon;
              return (
                <div
                  key={tool.tool_id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-ember-700 dark:text-ember-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{tool.name}</p>
                    <p className="text-xs text-muted-foreground">{meta.label}</p>
                  </div>
                  <button
                    onClick={() => void deleteTool.mutateAsync(tool.tool_id)}
                    aria-label={`Delete ${tool.name}`}
                    className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })
          )}

          {!showForm ? (
            <button
              onClick={() => setShowForm(true)}
              className="w-full h-12 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add tool
            </button>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-border bg-card p-4 space-y-3"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(Object.keys(KIND_META) as Kind[]).map((option) => {
                  const meta = KIND_META[option];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={option}
                      onClick={() => setKind(option)}
                      title={meta.hint}
                      className={cn(
                        "flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs transition-colors",
                        kind === option
                          ? "border-primary/40 bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Tool name, e.g. transfer_to_support"
                aria-label="Tool name"
                className={cn(fieldStyles.field, "font-mono text-xs")}
              />
              <KindFields kind={kind} draft={draft} setDraft={setDraft} />
              {formError && (
                <p className="text-xs text-red-700 dark:text-red-400">{formError}</p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={() => void handleCreate()}
                  disabled={createTool.isPending}
                  className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
                >
                  {createTool.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  Create tool
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
            </motion.div>
          )}
        </div>
      </FormSection>
    </div>
  );
}
