"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Database, FileText, Link2, Loader2, Plus, Trash2, Type, X } from "lucide-react";
import { useAgents } from "@/services/api";
import {
  useAttachKnowledgeBase,
  useCreateKnowledgeBase,
  useDeleteKnowledgeBase,
  useDetachKnowledgeBase,
  useKnowledgeBases,
} from "@/services/platform/knowledgebases";
import type { KnowledgeBase } from "@/lib/schemas/platform";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

type SourceType = "pdf" | "url" | "text";

const SOURCE_ICONS: Record<SourceType, typeof FileText> = {
  pdf: FileText,
  url: Link2,
  text: Type,
};


function KbRow({ kb, agentNames }: { kb: KnowledgeBase; agentNames: Map<string, string> }) {
  const attach = useAttachKnowledgeBase();
  const detach = useDetachKnowledgeBase();
  const remove = useDeleteKnowledgeBase();
  const { data: agents } = useAgents();
  const [attachTarget, setAttachTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const run = async (action: () => Promise<unknown>) => {
    setError(null);
    try {
      await action();
      setAttachTarget("");
    } catch {
      setError("Request failed. Is the backend running?");
    }
  };

  return (
    <div className="p-5 bg-card border border-border rounded-3xl">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Database className="w-4 h-4 text-ember-700 dark:text-ember-300" />
          </div>
          <div className="min-w-0">
            <h3 className="font-medium text-foreground tracking-tight truncate">{kb.name}</h3>
            <p className="text-xs font-mono text-muted-foreground">
              {kb.sources.length} source{kb.sources.length === 1 ? "" : "s"} · {kb.status}
            </p>
          </div>
        </div>
        <button
          onClick={() => void run(() => remove.mutateAsync(kb.kb_id))}
          aria-label={`Delete ${kb.name}`}
          className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {kb.sources.map((source, index) => {
          const Icon = SOURCE_ICONS[source.type as SourceType] ?? FileText;
          return (
            <span
              key={index}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-mono bg-muted text-muted-foreground border border-border max-w-full"
            >
              <Icon className="w-3 h-3 shrink-0" />
              <span className="truncate max-w-[220px]">{source.ref}</span>
            </span>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {kb.agent_ids.map((agentId) => (
          <span
            key={agentId}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
          >
            {agentNames.get(agentId) ?? `${agentId.slice(0, 8)}…`}
            <button
              onClick={() => void run(() => detach.mutateAsync({ id: kb.kb_id, agent_id: agentId }))}
              aria-label={`Detach from ${agentNames.get(agentId) ?? agentId}`}
              className="hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        {kb.agent_ids.length === 0 && (
          <span className="text-xs text-muted-foreground">Not attached to any agent.</span>
        )}
      </div>

      <div className="flex gap-2">
        <select
          value={attachTarget}
          onChange={(event) => setAttachTarget(event.target.value)}
          aria-label={`Attach ${kb.name} to agent`}
          className={cn(fieldStyles.fieldSm, "flex-1")}
        >
          <option value="">Attach to agent…</option>
          {(agents ?? [])
            .filter((agent) => !kb.agent_ids.includes(agent.agent_id))
            .map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>
                {agent.agent_name}
              </option>
            ))}
        </select>
        <button
          onClick={() =>
            attachTarget && void run(() => attach.mutateAsync({ id: kb.kb_id, agent_id: attachTarget }))
          }
          disabled={!attachTarget || attach.isPending}
          className="h-10 px-4 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
        >
          Attach
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-700 dark:text-red-400">{error}</p>}
    </div>
  );
}

export function KbManager() {
  const { data: kbs, isLoading } = useKnowledgeBases();
  const { data: agents } = useAgents();
  const createKb = useCreateKnowledgeBase();

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [sources, setSources] = useState<{ type: SourceType; ref: string }[]>([{ type: "url", ref: "" }]);
  const [formError, setFormError] = useState<string | null>(null);

  const agentNames = new Map((agents ?? []).map((agent) => [agent.agent_id, agent.agent_name]));

  const setSource = (index: number, patch: Partial<{ type: SourceType; ref: string }>) =>
    setSources((prev) => prev.map((source, i) => (i === index ? { ...source, ...patch } : source)));

  const handleCreate = async () => {
    setFormError(null);
    const cleaned = sources.map((s) => ({ type: s.type, ref: s.ref.trim() })).filter((s) => s.ref);
    if (!name.trim()) {
      setFormError("Give the knowledge base a name.");
      return;
    }
    try {
      await createKb.mutateAsync({ name: name.trim(), sources: cleaned });
      setName("");
      setSources([{ type: "url", ref: "" }]);
      setShowForm(false);
    } catch {
      setFormError("Could not create the knowledge base. Is the backend running?");
    }
  };

  return (
    <div className="space-y-4">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full h-12 rounded-2xl border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" /> New knowledge base
        </button>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl border border-border bg-card p-5 space-y-3"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Knowledge base name, e.g. Refund policy"
            aria-label="Knowledge base name"
            className={fieldStyles.fieldSm}
          />
          <AnimatePresence initial={false}>
            {sources.map((source, index) => (
              <motion.div key={index} layout="position" className="flex gap-2">
                <select
                  value={source.type}
                  onChange={(event) => setSource(index, { type: event.target.value as SourceType })}
                  aria-label={`Source ${index + 1} type`}
                  className={cn(fieldStyles.fieldSm, "w-28 shrink-0")}
                >
                  <option value="url">URL</option>
                  <option value="pdf">PDF</option>
                  <option value="text">Text</option>
                </select>
                <input
                  value={source.ref}
                  onChange={(event) => setSource(index, { ref: event.target.value })}
                  placeholder={source.type === "url" ? "https://…" : source.type === "pdf" ? "file key or path" : "Inline text"}
                  aria-label={`Source ${index + 1} reference`}
                  className={cn(fieldStyles.fieldSm, "font-mono text-xs")}
                />
                {sources.length > 1 && (
                  <button
                    onClick={() => setSources((prev) => prev.filter((_, i) => i !== index))}
                    aria-label={`Remove source ${index + 1}`}
                    className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
          <button
            onClick={() => setSources((prev) => [...prev, { type: "url" as SourceType, ref: "" }])}
            className="text-xs text-ember-700 dark:text-ember-300 hover:underline underline-offset-4"
          >
            + Add source
          </button>
          {formError && (
            <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
              <AlertCircle className="w-3.5 h-3.5" /> {formError}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => void handleCreate()}
              disabled={createKb.isPending}
              className="flex-1 h-10 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {createKb.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              Create
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

      {isLoading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="h-48 rounded-3xl bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : (kbs ?? []).length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-10 text-center">
          No knowledge bases yet. Upload PDFs and URLs so agents answer from your content.
        </p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(kbs ?? []).map((kb) => (
            <KbRow key={kb.kb_id} kb={kb} agentNames={agentNames} />
          ))}
        </div>
      )}
    </div>
  );
}
