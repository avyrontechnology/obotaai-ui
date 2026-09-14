"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Trash2, Workflow } from "lucide-react";
import Link from "next/link";
import { timeAgo } from "@/lib/format";
import { notify } from "@/lib/notify";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { useCreateWorkflow, useDeleteWorkflow, useWorkflows } from "@/services/platform/workflows";
import { useRouter } from "next/navigation";

const WORKFLOW_PAGE_SIZE = 12;

/** Outreach-workflow list + create. Rendered inside the unified Flows section. */
export function WorkflowsPanel() {
  const router = useRouter();
  const { data: workflows, isLoading, error, refetch } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const rows = useMemo(() => workflows ?? [], [workflows]);
  const pageCount = Math.max(1, Math.ceil(rows.length / WORKFLOW_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => rows.slice(safePage * WORKFLOW_PAGE_SIZE, safePage * WORKFLOW_PAGE_SIZE + WORKFLOW_PAGE_SIZE),
    [rows, safePage]
  );

  const handleCreate = async () => {
    if (!name.trim()) return;
    setFormError(null);
    try {
      const workflow = await createWorkflow.mutateAsync({
        name: name.trim(),
        definition: {
          nodes: [
            { id: "start", type: "start", label: "Start", config: {} },
            { id: "call", type: "agent", label: "Call", config: {} },
            { id: "done", type: "end", label: "End", config: {} },
          ],
          edges: [],
        },
      });
      setName("");
      setShowForm(false);
      router.push(`/workflows/${workflow.workflow_id}`);
    } catch {
      setFormError("Could not create the workflow. Is the backend running?");
    }
  };

  return (
    <>
      <div className="flex justify-end mb-6">
        <button
          onClick={() => {
            setShowForm((value) => !value);
            setFormError(null);
          }}
          aria-expanded={showForm}
          className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-lg transition-all duration-200 hover:bg-primary/90 hover:shadow-xl cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none flex items-center gap-2"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>New Workflow</span>
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="mb-6 motion-reduce:transition-none"
        >
          <div className="flex flex-col sm:flex-row gap-2 max-w-xl">
            <input
              id="workflow-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleCreate();
              }}
              placeholder="Workflow name, e.g. Lead revival"
              aria-label="Workflow name"
              aria-invalid={formError !== null}
              className="flex-1 h-11 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50"
            />
            <button
              onClick={() => void handleCreate()}
              disabled={createWorkflow.isPending || !name.trim()}
              className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold transition-colors duration-200 hover:bg-primary/90 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none flex items-center justify-center gap-2 shrink-0"
            >
              {createWorkflow.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Create
            </button>
          </div>
          {formError && (
            <p
              role="alert"
              tabIndex={-1}
              ref={(el) => el?.focus()}
              className="mt-2 text-sm text-red-700 dark:text-red-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 rounded"
            >
              {formError}{" "}
              <a
                href="#workflow-name"
                onClick={(event) => {
                  const target = document.getElementById("workflow-name");
                  if (target) {
                    event.preventDefault();
                    (target as HTMLElement).focus();
                    target.scrollIntoView?.({ block: "center" });
                  }
                }}
                className="underline underline-offset-2 cursor-pointer"
              >
                Go to workflow name
              </a>
            </p>
          )}
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-[2rem] bg-card border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Failed to load workflows." onRetry={() => refetch()} />
      ) : rows.length === 0 && !showForm ? (
        <EmptyState
          icon={Workflow}
          title="No workflows yet"
          description="Create one to chain calls, APIs and follow-ups with test-runs and campaigns."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {pageRows.map((workflow) => (
              <div
                key={workflow.workflow_id}
                className="group relative p-6 bg-card border border-border rounded-[2rem] transition-colors duration-200 hover:bg-muted/40 min-w-0"
              >
                <div className="flex items-center gap-3 mb-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Workflow className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold tracking-tight text-foreground truncate" title={workflow.name}>{workflow.name}</h3>
                    <p className="text-xs font-mono text-muted-foreground tabular-nums">
                      {workflow.definition.nodes.length} steps · {timeAgo(workflow.updated_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!confirm(`Delete workflow "${workflow.name}"? This cannot be undone.`)) return;
                      void deleteWorkflow
                        .mutateAsync(workflow.workflow_id)
                        .then(() => notify.success("Workflow deleted", { description: workflow.name }))
                        .catch((err) => notify.error("Delete failed", err));
                    }}
                    aria-label={`Delete ${workflow.name}`}
                    title={`Delete ${workflow.name}`}
                    className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors duration-200 cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
                <Link
                  href={`/workflows/${workflow.workflow_id}`}
                  className="flex h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 hover:border-primary/25 transition-colors duration-200 cursor-pointer items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                >
                  Open builder
                </Link>
              </div>
            ))}
          </div>
          {pageCount > 1 && (
            <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pb-1">
              <p className="text-xs font-mono text-muted-foreground tabular-nums" aria-live="polite">
                Showing {safePage * WORKFLOW_PAGE_SIZE + 1}–{safePage * WORKFLOW_PAGE_SIZE + pageRows.length} of {rows.length} workflows
              </p>
              <nav aria-label="Workflow pages" className="flex items-center gap-2">
                <button
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage === 0}
                  aria-label="Previous page"
                  className="h-9 px-4 rounded-2xl bg-card border border-border text-sm font-medium transition-colors duration-200 hover:bg-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                >
                  Previous
                </button>
                <span className="text-xs font-mono text-muted-foreground min-w-[64px] text-center tabular-nums">
                  Page {safePage + 1} of {pageCount}
                </span>
                <button
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= pageCount - 1}
                  aria-label="Next page"
                  className="h-9 px-4 rounded-2xl bg-card border border-border text-sm font-medium transition-colors duration-200 hover:bg-accent disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                >
                  Next
                </button>
              </nav>
            </div>
          )}
        </>
      )}
    </>
  );
}
