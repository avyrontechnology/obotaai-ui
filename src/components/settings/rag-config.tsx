"use client";

import { useState } from "react";
import { AlertCircle, Check, Database, Loader2, X } from "lucide-react";
import { FormSection } from "./form-controls";
import {
  useAttachKnowledgeBase,
  useDetachKnowledgeBase,
  useKnowledgeBases,
  useUpdateVectorConfig,
  useVectorConfig,
} from "@/services/platform/knowledgebases";
import type { VectorStoreConfig } from "@/lib/schemas/platform";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


const numberOr = (value: string, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

interface VectorDraft {
  provider: "mongodb" | "lancedb";
  connection_string: string;
  db_name: string;
  collection_name: string;
  index_name: string;
  embedding_model: string;
  embedding_dimensions: string;
  vector_id: string;
  similarity_top_k: string;
  score_threshold: string;
  reranker_enabled: boolean;
  reranker_model_type: string;
  candidate_count: string;
  final_count: string;
}

function fromStored(config: VectorStoreConfig): VectorDraft {
  return {
    provider: config.provider,
    connection_string: config.connection_string ?? "",
    db_name: config.db_name ?? "",
    collection_name: config.collection_name ?? "",
    index_name: config.index_name ?? "",
    embedding_model: config.embedding_model ?? "",
    embedding_dimensions: config.embedding_dimensions?.toString() ?? "",
    vector_id: config.vector_id ?? "",
    similarity_top_k: String(config.similarity_top_k),
    score_threshold: String(config.score_threshold),
    reranker_enabled: config.reranker_enabled,
    reranker_model_type: config.reranker_model_type,
    candidate_count: String(config.candidate_count),
    final_count: String(config.final_count),
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function RAGConfigForm({ agentId }: { agentId?: string }) {
  const { data: kbs } = useKnowledgeBases();
  const attachKb = useAttachKnowledgeBase();
  const detachKb = useDetachKnowledgeBase();
  const { data: stored } = useVectorConfig(agentId ?? "", !!agentId);
  const updateVector = useUpdateVectorConfig(agentId ?? "");

  const [attachTarget, setAttachTarget] = useState("");
  const [kbError, setKbError] = useState<string | null>(null);
  const [draft, setDraft] = useState<VectorDraft | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);

  if (stored && draft === null) {
    const next = fromStored(stored);
    setDraft(next);
    setSavedSnapshot(JSON.stringify(next));
  }

  const editable = draft ?? fromStoredFallback();
  const dirty = draft !== null && JSON.stringify(draft) !== savedSnapshot;

  const patch = (update: Partial<VectorDraft>) => {
    setDraft((prev) => ({ ...(prev ?? fromStoredFallback()), ...update }));
    setSavedFlash(false);
  };

  const attached = (kbs ?? []).filter((kb) => agentId && kb.agent_ids.includes(agentId));
  const unattached = (kbs ?? []).filter((kb) => agentId && !kb.agent_ids.includes(agentId));

  const runAttach = async (action: () => Promise<unknown>) => {
    setKbError(null);
    try {
      await action();
      setAttachTarget("");
    } catch {
      setKbError("Request failed. Is the backend running?");
    }
  };

  const handleVectorSave = async () => {
    if (!agentId) return;
    setSavedFlash(false);
    await updateVector.mutateAsync({
      provider: editable.provider,
      connection_string: editable.connection_string.trim() || null,
      db_name: editable.db_name.trim() || null,
      collection_name: editable.collection_name.trim() || null,
      index_name: editable.index_name.trim() || null,
      embedding_model: editable.embedding_model.trim() || null,
      embedding_dimensions: editable.embedding_dimensions.trim()
        ? numberOr(editable.embedding_dimensions, 0)
        : null,
      vector_id: editable.vector_id.trim() || null,
      similarity_top_k: numberOr(editable.similarity_top_k, 5),
      score_threshold: numberOr(editable.score_threshold, 0.1),
      reranker_enabled: editable.reranker_enabled,
      reranker_model_type: editable.reranker_model_type.trim() || "minilm-l6-v2",
      candidate_count: numberOr(editable.candidate_count, 20),
      final_count: numberOr(editable.final_count, 5),
    });
    setSavedSnapshot(JSON.stringify(editable));
    setSavedFlash(true);
  };

  return (
    <div className="space-y-10">
      <FormSection
        title="Attached Knowledge Bases"
        description="Content packs this agent answers from. Managed in Knowledge Base."
      >
        <div className="col-span-1 md:col-span-2 space-y-3">
          {!agentId ? (
            <p className="text-sm text-muted-foreground">Save the agent first to attach knowledge.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {attached.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nothing attached yet.</p>
                )}
                {attached.map((kb) => (
                  <span
                    key={kb.kb_id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 text-xs"
                  >
                    <Database className="w-3.5 h-3.5" />
                    {kb.name}
                    <button
                      onClick={() =>
                        void runAttach(() => detachKb.mutateAsync({ id: kb.kb_id, agent_id: agentId }))
                      }
                      aria-label={`Detach ${kb.name}`}
                      className="hover:text-foreground transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
              {unattached.length > 0 && (
                <div className="flex gap-2">
                  <select
                    value={attachTarget}
                    onChange={(event) => setAttachTarget(event.target.value)}
                    aria-label="Knowledge base to attach"
                    className={cn(fieldStyles.field, "flex-1")}
                  >
                    <option value="">Attach existing…</option>
                    {unattached.map((kb) => (
                      <option key={kb.kb_id} value={kb.kb_id}>
                        {kb.name} ({kb.sources.length} sources)
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      attachTarget &&
                      void runAttach(() => attachKb.mutateAsync({ id: attachTarget, agent_id: agentId }))
                    }
                    disabled={!attachTarget}
                    className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors shrink-0"
                  >
                    Attach
                  </button>
                </div>
              )}
              {kbError && <p className="text-xs text-red-700 dark:text-red-400">{kbError}</p>}
            </>
          )}
        </div>
      </FormSection>

      <FormSection
        title="Vector Store"
        description="Direct connection for knowledge & graph agents. Saved to the platform, independently of the agent record."
      >
        <Field label="Provider">
          <select
            value={editable.provider}
            onChange={(event) => patch({ provider: event.target.value as "mongodb" | "lancedb" })}
            aria-label="Vector store provider"
            className={fieldStyles.field}
          >
            <option value="mongodb">MongoDB Atlas</option>
            <option value="lancedb">LanceDB</option>
          </select>
        </Field>
        {editable.provider === "mongodb" ? (
          <>
            <Field label="Connection String">
              <input
                value={editable.connection_string}
                onChange={(event) => patch({ connection_string: event.target.value })}
                placeholder="mongodb+srv://…"
                aria-label="MongoDB connection string"
                className={cn(fieldStyles.field, "font-mono text-xs")}
              />
            </Field>
            <Field label="Database">
              <input
                value={editable.db_name}
                onChange={(event) => patch({ db_name: event.target.value })}
                placeholder="otobaai"
                aria-label="Database name"
                className={fieldStyles.field}
              />
            </Field>
            <Field label="Collection">
              <input
                value={editable.collection_name}
                onChange={(event) => patch({ collection_name: event.target.value })}
                placeholder="support_docs"
                aria-label="Collection name"
                className={fieldStyles.field}
              />
            </Field>
            <Field label="Index">
              <input
                value={editable.index_name}
                onChange={(event) => patch({ index_name: event.target.value })}
                placeholder="vector_index"
                aria-label="Index name"
                className={fieldStyles.field}
              />
            </Field>
            <Field label="Embedding Model">
              <input
                value={editable.embedding_model}
                onChange={(event) => patch({ embedding_model: event.target.value })}
                placeholder="text-embedding-3-small"
                aria-label="Embedding model"
                className={fieldStyles.field}
              />
            </Field>
            <Field label="Dimensions">
              <input
                value={editable.embedding_dimensions}
                onChange={(event) => patch({ embedding_dimensions: event.target.value })}
                placeholder="256"
                inputMode="numeric"
                aria-label="Embedding dimensions"
                className={fieldStyles.field}
              />
            </Field>
          </>
        ) : (
          <Field label="Vector ID">
            <input
              value={editable.vector_id}
              onChange={(event) => patch({ vector_id: event.target.value })}
              placeholder="support-docs"
              aria-label="LanceDB vector ID"
              className={cn(fieldStyles.field, "font-mono text-xs")}
            />
          </Field>
        )}
        <Field label="Top K">
          <input
            value={editable.similarity_top_k}
            onChange={(event) => patch({ similarity_top_k: event.target.value })}
            inputMode="numeric"
            aria-label="Similarity top K"
            className={fieldStyles.field}
          />
        </Field>
        <Field label="Score Threshold">
          <input
            value={editable.score_threshold}
            onChange={(event) => patch({ score_threshold: event.target.value })}
            inputMode="decimal"
            aria-label="Score threshold"
            className={fieldStyles.field}
          />
        </Field>
        <div className="col-span-1 md:col-span-2 flex items-start justify-between gap-4 p-4 rounded-xl bg-muted/50 border border-border">
          <div className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">Reranker</span>
            <span className="text-xs text-muted-foreground">Re-score retrieved chunks before answering</span>
          </div>
          <Toggle
            checked={editable.reranker_enabled}
            onChange={(value) => patch({ reranker_enabled: value })}
            label="Reranker enabled"
          />
        </div>
        {editable.reranker_enabled && (
          <>
            <Field label="Reranker Model">
              <select
                value={editable.reranker_model_type}
                onChange={(event) => patch({ reranker_model_type: event.target.value })}
                aria-label="Reranker model"
                className={fieldStyles.field}
              >
                <option value="minilm-l6-v2">minilm-l6-v2</option>
                <option value="bge-base">bge-base</option>
                <option value="bge-large">bge-large</option>
                <option value="bge-multilingual">bge-multilingual</option>
              </select>
            </Field>
            <Field label="Candidates">
              <input
                value={editable.candidate_count}
                onChange={(event) => patch({ candidate_count: event.target.value })}
                inputMode="numeric"
                aria-label="Reranker candidate count"
                className={fieldStyles.field}
              />
            </Field>
            <Field label="Final Count">
              <input
                value={editable.final_count}
                onChange={(event) => patch({ final_count: event.target.value })}
                inputMode="numeric"
                aria-label="Reranker final count"
                className={fieldStyles.field}
              />
            </Field>
          </>
        )}
      </FormSection>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleVectorSave().catch(() => undefined)}
          disabled={!agentId || updateVector.isPending || !dirty}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {updateVector.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Vector Store
        </button>
        {savedFlash && !dirty && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
        {updateVector.isError && (
          <span className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4" /> Save failed
          </span>
        )}
      </div>
    </div>
  );
}

function fromStoredFallback(): VectorDraft {
  return {
    provider: "mongodb",
    connection_string: "",
    db_name: "",
    collection_name: "",
    index_name: "",
    embedding_model: "",
    embedding_dimensions: "",
    vector_id: "",
    similarity_top_k: "5",
    score_threshold: "0.1",
    reranker_enabled: false,
    reranker_model_type: "minilm-l6-v2",
    candidate_count: "20",
    final_count: "5",
  };
}
