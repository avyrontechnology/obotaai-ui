"use client";

import { Suspense, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronRight, Megaphone, Plus, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BatchCreateDialog } from "@/components/batches/batch-create-dialog";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { SkeletonList } from "@/components/common/skeleton-list";
import { ErrorState } from "@/components/common/error-state";
import { BatchStatusBadge } from "@/components/batches/batch-status-badge";
import { timeAgo } from "@/lib/format";
import { useAgents } from "@/services/api";
import { useBatches } from "@/services/platform/batches";
import { minRoleFor, useCan } from "@/lib/rbac";

export default function BatchesPage() {
  return (
    <Suspense>
      <BatchesContent />
    </Suspense>
  );
}

function BatchesContent() {
  const searchParams = useSearchParams();
  // ?agent= from the agent overview filters the list and prefills the
  // create dialog. ?new= auto-opens the dialog (Launch Campaign flow).
  const deepLinkedAgent = searchParams.get("agent") ?? undefined;
  const canWrite = useCan("batches.write");
  // Auto-open is param-driven; the dialog itself gates submission by role.
  const [dialogOpen, setDialogOpen] = useState(() => searchParams.get("new") !== null);
  const { data: batches, isLoading, error, refetch } = useBatches(deepLinkedAgent);
  const { data: agents } = useAgents();

  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.agent_id, agent.agent_name));
    return map;
  }, [agents]);

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      <PageHeader
        title="Batch"
        accent="Campaigns"
        description="Call a list of people in one campaign — upload a CSV, start it, track every outcome."
        actions={
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            onClick={() => setDialogOpen(true)}
            disabled={!canWrite}
            title={canWrite ? undefined : `Requires ${minRoleFor("batches.write")} role`}
            className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-lg transition-all hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 self-start md:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>New Campaign</span>
          </motion.button>
        }
      />

      {deepLinkedAgent && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/batches"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
          >
            agent: {agentNames.get(deepLinkedAgent) ?? `${deepLinkedAgent.slice(0, 14)}…`} <X className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={3} rowClassName="h-24" />
      ) : error ? (
      <ErrorState message="Failed to load campaigns. Is the backend running?" onRetry={() => refetch()} />
      ) : (batches ?? []).length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title={deepLinkedAgent ? "No campaigns for this agent" : "No campaigns yet"}
          description="Upload a CSV of recipients and run your first bulk-calling campaign."
        >
          <button
            onClick={() => setDialogOpen(true)}
            disabled={!canWrite}
            title={canWrite ? undefined : `Requires ${minRoleFor("batches.write")} role`}
            className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50"
          >
            Create Campaign
          </button>
        </EmptyState>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          {batches?.map((batch) => {
            const done = batch.stats.completed + batch.stats.failed;
            const progress = batch.stats.total > 0 ? Math.round((done / batch.stats.total) * 100) : 0;
            return (
              <Link
                key={batch.batch_id}
                href={`/batches/${batch.batch_id}`}
                className="block p-5 md:px-6 bg-card border border-border rounded-3xl transition-colors hover:bg-muted/60 group"
              >
                <div className="flex items-center justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <h3 className="font-medium text-foreground tracking-tight truncate">{batch.name}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {agentNames.get(batch.agent_id) ?? "Unknown agent"} · {timeAgo(batch.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <BatchStatusBadge status={batch.status} />
                    <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <ProgressBar value={progress} />
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {done}/{batch.stats.total}
                  </span>
                </div>
              </Link>
            );
          })}
        </motion.div>
      )}

      <BatchCreateDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialAgentId={deepLinkedAgent ?? ""}
      />
    </div>
  );
}
