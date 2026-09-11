"use client";

import { Suspense, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Megaphone, Play, Plus, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BatchCreateDialog } from "@/components/batches/batch-create-dialog";
import { BatchListRow } from "@/components/batches/batch-list-row";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { SkeletonList } from "@/components/common/skeleton-list";
import { ErrorState } from "@/components/common/error-state";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";
import { useAgents } from "@/services/api";
import { useBatches } from "@/services/platform/batches";
import { minRoleFor, useCan } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import type { Batch } from "@/lib/schemas/platform";

type StatusFilter = "all" | Batch["status"];

const STATUS_OPTIONS: StatusFilter[] = ["all", "draft", "scheduled", "running", "paused", "completed", "stopped"];

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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data: batches, isLoading, error, refetch } = useBatches(deepLinkedAgent);
  const { data: agents } = useAgents();

  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.agent_id, agent.agent_name));
    return map;
  }, [agents]);

  const summary = useMemo(() => {
    const rows = batches ?? [];
    let running = 0;
    let scheduled = 0;
    let paused = 0;
    let completed = 0;
    let sumTotal = 0;
    let sumCompleted = 0;
    let sumFailed = 0;
    let sumQueued = 0;
    for (const batch of rows) {
      if (batch.status === "running") running += 1;
      if (batch.status === "scheduled") scheduled += 1;
      if (batch.status === "paused") paused += 1;
      if (batch.status === "completed") completed += 1;
      sumTotal += batch.stats.total;
      sumCompleted += batch.stats.completed;
      sumFailed += batch.stats.failed;
      sumQueued += batch.stats.queued;
    }
    return { total: rows.length, running, scheduled, paused, completed, sumTotal, sumCompleted, sumFailed, sumQueued };
  }, [batches]);

  // Client-side only: the /batches API supports ?agent_id but has no
  // status/search parameter, so these narrow the loaded rows locally.
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (batches ?? []).filter((batch) => {
      if (statusFilter !== "all" && batch.status !== statusFilter) return false;
      if (!needle) return true;
      const agentName = agentNames.get(batch.agent_id) ?? "";
      return (
        batch.name.toLowerCase().includes(needle) ||
        agentName.toLowerCase().includes(needle) ||
        batch.batch_id.toLowerCase().includes(needle)
      );
    });
  }, [batches, query, statusFilter, agentNames]);

  const countBadge = isLoading ? "—" : `${summary.total} campaign${summary.total === 1 ? "" : "s"}`;

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title={
          <>
            <span className="truncate">Batch Campaigns</span>
            <span
              title={isLoading ? "Loading campaigns" : `${summary.total} campaigns`}
              className="font-mono text-xs font-normal tracking-normal px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground shrink-0 tabular-nums"
            >
              {countBadge}
            </span>
          </>
        }
        description="Call a list of people in one campaign — upload a CSV, start it, track every outcome."
        actions={
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search campaigns..."
              label="Search campaigns"
              className="w-full sm:w-auto"
            />
            <motion.button
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
              onClick={() => setDialogOpen(true)}
              disabled={!canWrite}
              title={canWrite ? undefined : `Requires ${minRoleFor("batches.write")} role`}
              className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-lg shadow-primary/20 transition-all hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2 self-start sm:self-auto shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>New Campaign</span>
            </motion.button>
          </>
        }
      />

      {deepLinkedAgent && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Link
            href="/batches"
            title={deepLinkedAgent}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            agent: {agentNames.get(deepLinkedAgent) ?? `${deepLinkedAgent.slice(0, 14)}…`} <X className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>
      )}

      <SettingsStatsGrid label="Campaign summary">
        <SettingsStatCard
          title="Total campaigns"
          icon={Megaphone}
          value={isLoading ? "—" : String(summary.total)}
          caption={isLoading ? "—" : `${summary.sumTotal.toLocaleString()} recipients total`}
          loading={isLoading}
          delay={0}
        />
        <SettingsStatCard
          title="Running"
          icon={Play}
          value={isLoading ? "—" : String(summary.running)}
          caption={isLoading ? "—" : `${summary.scheduled} scheduled · ${summary.paused} paused`}
          loading={isLoading}
          delay={0.05}
        />
        <SettingsStatCard
          title="Completed"
          icon={CheckCircle2}
          value={isLoading ? "—" : String(summary.completed)}
          caption={isLoading ? "—" : `${summary.sumCompleted.toLocaleString()} calls completed`}
          loading={isLoading}
          delay={0.1}
        />
        <SettingsStatCard
          title="Failed calls"
          icon={AlertTriangle}
          value={isLoading ? "—" : String(summary.sumFailed)}
          caption={isLoading ? "—" : `${summary.sumQueued.toLocaleString()} queued`}
          loading={isLoading}
          delay={0.15}
        />
      </SettingsStatsGrid>

      {/* Filter bar — client-side only (no backend status/search param) */}
      {!isLoading && !error && (batches ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option}
              onClick={() => setStatusFilter(option)}
              aria-pressed={statusFilter === option}
              className={cn(
                "px-4 h-9 rounded-full text-xs font-mono border transition-colors duration-200 capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
                statusFilter === option
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {option}
            </button>
          ))}
          <span className="ml-auto text-xs font-mono text-muted-foreground tabular-nums" aria-live="polite">
            {filtered.length} of {summary.total} shown
          </span>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={5} />
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
            className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:shadow-xl disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            Create Campaign
          </button>
        </EmptyState>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="No matching campaigns"
          description="No campaigns match this search or status filter. Try clearing them."
        >
          <button
            onClick={() => {
              setQuery("");
              setStatusFilter("all");
            }}
            className="px-6 py-3 rounded-2xl bg-card border border-border text-sm font-semibold transition-all hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            Clear filters
          </button>
        </EmptyState>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col gap-4 motion-reduce:transition-none"
        >
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="col-span-4 truncate">Campaign</div>
            <div className="col-span-2 truncate">Status</div>
            <div className="col-span-3 truncate">Progress</div>
            <div className="col-span-2 truncate">Schedule</div>
            <div className="col-span-1 text-right truncate">Actions</div>
          </div>

          <AnimatePresence initial={false}>
            {filtered.map((batch, index) => (
              <BatchListRow
                key={batch.batch_id}
                batch={batch}
                agentName={agentNames.get(batch.agent_id) ?? "Unknown agent"}
                index={index}
              />
            ))}
          </AnimatePresence>
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
