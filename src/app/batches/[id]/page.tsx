"use client";

import { use, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Loader2,
  Play,
  RotateCcw,
  Square,
} from "lucide-react";
import Link from "next/link";
import { ErrorState } from "@/components/common/error-state";
import { PageHeader } from "@/components/common/page-header";
import { ProgressBar } from "@/components/common/progress-bar";
import { BatchStatusBadge } from "@/components/batches/batch-status-badge";
import { ExecutionDrawer } from "@/components/calls/execution-drawer";
import { StatusBadge } from "@/components/calls/status-badge";
import { formatDuration, formatLatency, timeAgo } from "@/lib/format";
import { useAgents } from "@/services/api";
import {
  useBatch,
  useBatchExecutions,
  useRetryFailed,
  useStartBatch,
  useStopBatch,
} from "@/services/platform/batches";
import { ApiError } from "@/lib/api-client";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

function actionClass(primary = false): string {
  return cn(
    "h-11 px-5 rounded-2xl font-medium text-sm transition-all flex items-center gap-2 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
    primary
      ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg shadow-primary/20"
      : "bg-card border border-border text-foreground hover:bg-accent"
  );
}

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [selectedExecution, setSelectedExecution] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: batch, isLoading, error, refetch } = useBatch(id);
  const { data: executions, refetch: refetchExecutions } = useBatchExecutions(id, !!batch);
  const { data: agents } = useAgents();
  const startBatch = useStartBatch();
  const stopBatch = useStopBatch();
  const retryFailed = useRetryFailed();

  const running = batch?.status === "running";
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      refetch();
      refetchExecutions();
    }, 3000);
    return () => clearInterval(timer);
  }, [running, refetch, refetchExecutions]);

  const agentName = useMemo(
    () => agents?.find((agent) => agent.agent_id === batch?.agent_id)?.agent_name ?? "Unknown agent",
    [agents, batch]
  );

  const done = (batch?.stats.completed ?? 0) + (batch?.stats.failed ?? 0);
  const progress = batch && batch.stats.total > 0 ? Math.round((done / batch.stats.total) * 100) : 0;

  const runAction = async (action: () => Promise<unknown>, successMessage?: string) => {
    setActionError(null);
    try {
      await action();
      if (successMessage) notify.success(successMessage);
      refetch();
      refetchExecutions();
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : "Action failed. Please retry.");
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8 space-y-4" aria-hidden="true">
        <div className="h-12 w-64 rounded-2xl bg-card border border-border animate-pulse motion-reduce:animate-none" />
        <div className="h-40 rounded-[2rem] bg-card border border-border animate-pulse motion-reduce:animate-none" />
        <div className="h-64 rounded-[2rem] bg-card border border-border animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
        <ErrorState message="Campaign not found.">
          <Link
            href="/batches"
            className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
          >
            Back to Campaigns
          </Link>
        </ErrorState>
      </div>
    );
  }

  const busy = startBatch.isPending || stopBatch.isPending || retryFailed.isPending;

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <Link
        href="/batches"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
      >
        <ArrowLeft className="w-4 h-4" /> Campaigns
      </Link>

      <PageHeader
        title={
          <span className="flex items-center gap-3 min-w-0 flex-1">
            <span className="truncate" title={batch.name}>{batch.name}</span>
            <span className="shrink-0"><BatchStatusBadge status={batch.status} /></span>
          </span>
        }
        description={
          <span>
            {agentName} · created {timeAgo(batch.created_at)}
            {batch.calling_hours && (
              <> · calling hours {batch.calling_hours.start}–{batch.calling_hours.end}</>
            )}
          </span>
        }
        className="mb-8"
        actions={
          <>
            {(batch.status === "draft" || batch.status === "scheduled") && (
              <button
                onClick={() => void runAction(() => startBatch.mutateAsync(id), "Campaign started")}
                disabled={busy}
                className={actionClass(true)}
              >
                {startBatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start
              </button>
            )}
            {batch.status === "running" && (
              <button
                onClick={() => void runAction(() => stopBatch.mutateAsync(id), "Campaign stopped")}
                disabled={busy}
                className={actionClass()}
              >
                {stopBatch.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
                Stop
              </button>
            )}
            {batch.stats.failed > 0 && (
              <button
                onClick={() => void runAction(() => retryFailed.mutateAsync(id), "Retry batch created")}
                disabled={busy}
                className={actionClass()}
              >
                {retryFailed.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Retry {batch.stats.failed} failed
              </button>
            )}
          </>
        }
      />

      {actionError && (
        <p className="mb-6 flex items-center gap-2 text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
          <AlertCircle className="w-4 h-4 shrink-0" /> {actionError}
        </p>
      )}

      {/* Progress */}
      <div className="bg-card border border-border rounded-3xl p-5 md:p-6 mb-6 min-w-0">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
          {[
            { label: "Total", value: batch.stats.total },
            { label: "Completed", value: batch.stats.completed },
            { label: "Failed", value: batch.stats.failed },
            { label: "Queued", value: batch.stats.queued },
          ].map((stat) => (
            <div key={stat.label} className="min-w-0">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground truncate">{stat.label}</p>
              <p title={String(stat.value)} className="text-2xl md:text-3xl font-semibold tracking-tight text-foreground mt-1 tabular-nums truncate">{stat.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar value={progress} className="h-2.5" />
          <span className="text-xs font-mono text-muted-foreground shrink-0">{progress}%</span>
        </div>
      </div>

      {/* Per-call results */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h2 className="text-lg font-medium text-foreground truncate">Call results</h2>
        {(executions ?? []).length > 0 && (
          <Link
            href={`/calls?batch_id=${id}`}
            className="text-sm text-ember-700 dark:text-ember-300 hover:underline underline-offset-4 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            Open in Call History
          </Link>
        )}
      </div>
      {(executions ?? []).length === 0 ? (
        <div className="bg-card border border-border rounded-3xl p-6 md:p-8 text-center text-sm text-muted-foreground">
          {batch.status === "draft" || batch.status === "scheduled"
            ? "Start the campaign to place calls. Results appear here."
            : "No executions recorded yet."}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {executions?.map((execution) => (
            <button
              key={execution.execution_id}
              onClick={() => setSelectedExecution(execution.execution_id)}
              className="grid grid-cols-2 lg:grid-cols-12 gap-2 lg:gap-4 lg:items-center p-4 lg:px-6 bg-card border border-border rounded-3xl text-left transition-colors hover:bg-muted/60 group min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
            >
              <div className="col-span-1 lg:col-span-4 font-mono text-sm text-foreground min-w-0 truncate" title={execution.to_number ?? undefined}>
                {execution.to_number ?? "—"}
              </div>
              <div className="col-span-1 lg:col-span-3 min-w-0">
                <StatusBadge status={execution.status} />
              </div>
              <div title={`${formatDuration(execution.duration_s)} · ${formatLatency(execution.latency?.e2e_ms)}`} className="col-span-1 lg:col-span-3 text-xs font-mono text-muted-foreground truncate min-w-0 tabular-nums">
                {formatDuration(execution.duration_s)} · {formatLatency(execution.latency?.e2e_ms)}
              </div>
              <div className="col-span-1 lg:col-span-2 flex items-center justify-end gap-2 text-xs text-muted-foreground min-w-0">
                <span className="truncate tabular-nums" title={execution.started_at}>{timeAgo(execution.started_at)}</span>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 shrink-0 motion-reduce:transition-none" />
              </div>
            </button>
          ))}
        </div>
      )}

      <ExecutionDrawer executionId={selectedExecution} onClose={() => setSelectedExecution(null)} />
    </div>
  );
}
