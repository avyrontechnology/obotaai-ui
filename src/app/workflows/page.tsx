"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Plus, Trash2, Workflow } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/common/page-header";
import { timeAgo } from "@/lib/format";
import { ErrorState } from "@/components/common/error-state";
import { useCreateWorkflow, useDeleteWorkflow, useWorkflows } from "@/services/platform/workflows";
import { useRouter } from "next/navigation";

export default function WorkflowsPage() {
  const router = useRouter();
  const { data: workflows, isLoading, error, refetch } = useWorkflows();
  const createWorkflow = useCreateWorkflow();
  const deleteWorkflow = useDeleteWorkflow();
  const [name, setName] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
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
    router.push(`/workflows/${workflow.workflow_id}`);
  };

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      <PageHeader
        title="Work"
        accent="flows"
        description="Multi-step outreach: calls, extractions, APIs, waits, retries. Test-run, then campaign."
        actions={
          <button
            onClick={() => setShowForm((value) => !value)}
            className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-lg transition-all hover:bg-primary/90 flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Workflow</span>
          </button>
        }
      />

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex gap-2 max-w-xl"
        >
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleCreate().catch(() => undefined);
            }}
            placeholder="Workflow name, e.g. Lead revival"
            aria-label="Workflow name"
            className="flex-1 h-11 px-4 bg-card border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50"
          />
          <button
            onClick={() => void handleCreate().catch(() => undefined)}
            disabled={createWorkflow.isPending || !name.trim()}
            className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-2"
          >
            {createWorkflow.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Create
          </button>
        </motion.div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-48 rounded-[2rem] bg-card border border-border animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Failed to load workflows." onRetry={() => refetch()} />
      ) : (workflows ?? []).length === 0 && !showForm ? (
        <p className="text-sm text-muted-foreground rounded-[2rem] border border-dashed border-border p-10 text-center">
          No workflows yet. Create one to chain calls, APIs and follow-ups.
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(workflows ?? []).map((workflow) => (
            <div
              key={workflow.workflow_id}
              className="group relative p-6 bg-card border border-border rounded-[2rem] transition-colors hover:bg-muted/40"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <Workflow className="w-4 h-4 text-ember-700 dark:text-ember-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold tracking-tight text-foreground truncate">{workflow.name}</h3>
                  <p className="text-xs font-mono text-muted-foreground">
                    {workflow.definition.nodes.length} steps · {timeAgo(workflow.updated_at)}
                  </p>
                </div>
                <button
                  onClick={() => void deleteWorkflow.mutateAsync(workflow.workflow_id)}
                  aria-label={`Delete ${workflow.name}`}
                  className="p-2 rounded-xl text-muted-foreground hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <Link
                href={`/workflows/${workflow.workflow_id}`}
                className="block h-10 rounded-xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-center leading-10"
              >
                Open builder
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
