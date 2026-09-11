"use client";

import { memo, useState } from "react";
import { motion } from "framer-motion";
import { Check, ChevronRight, Megaphone, RotateCcw, Trash2, X } from "lucide-react";
import Link from "next/link";
import { BatchStatusBadge } from "@/components/batches/batch-status-badge";
import { ProgressBar } from "@/components/common/progress-bar";
import { timeAgo } from "@/lib/format";
import { notify } from "@/lib/notify";
import { minRoleFor, useCan } from "@/lib/rbac";
import { cn } from "@/lib/utils";
import { useDeleteBatch, useRetryFailed } from "@/services/platform/batches";
import type { Batch } from "@/lib/schemas/platform";

/** Honest schedule summary from real fields only. schedule_at + calling_hours or "—". */
function scheduleLabel(batch: Batch): { label: string; title?: string } {
  const parts: string[] = [];
  const titles: string[] = [];
  if (batch.schedule_at) {
    parts.push("Scheduled");
    titles.push(batch.schedule_at);
  }
  if (batch.calling_hours) {
    parts.push(`${batch.calling_hours.start}–${batch.calling_hours.end}`);
    titles.push(`${batch.calling_hours.start}–${batch.calling_hours.end}`);
  }
  if (parts.length === 0) return { label: "—" };
  return { label: parts.join(" · "), title: titles.join(" · ") };
}

export const BatchListRow = memo(function BatchListRow({
  batch,
  agentName,
  index,
}: {
  batch: Batch;
  agentName: string;
  index: number;
}) {
  const canWrite = useCan("batches.write");
  const deleteMutation = useDeleteBatch();
  const retryMutation = useRetryFailed();
  const [confirming, setConfirming] = useState(false);

  const done = batch.stats.completed + batch.stats.failed;
  const progress = batch.stats.total > 0 ? Math.round((done / batch.stats.total) * 100) : 0;
  const schedule = scheduleLabel(batch);
  const detailHref = `/batches/${batch.batch_id}`;
  const busy = deleteMutation.isPending || retryMutation.isPending;

  const handleRetry = () => {
    retryMutation.mutate(batch.batch_id, {
      onSuccess: () => notify.success("Retry batch created", { description: batch.name }),
      onError: (error) => notify.error("Retry failed", error),
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate(batch.batch_id, {
      onSuccess: () => notify.success("Campaign deleted", { description: batch.name }),
      onError: (error) => notify.error("Delete failed", error),
    });
    setConfirming(false);
  };

  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.18, delay: Math.min(index * 0.03, 0.24) }}
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:items-center p-5 md:p-6 bg-card border border-border rounded-3xl transition-colors duration-200 hover:bg-muted/60 hover:border-primary/25 focus-within:border-primary/40 group relative overflow-hidden min-w-0 motion-reduce:transition-none"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none motion-reduce:hidden"
      />

      {/* Campaign identity → detail */}
      <Link
        href={detailHref}
        className="lg:col-span-4 flex items-center gap-4 min-w-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center border border-border shadow-inner shrink-0 bg-ember-500/10">
          <Megaphone className="w-5 h-5 text-ember-700 dark:text-ember-300" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3
            title={batch.name}
            className="font-medium text-foreground tracking-tight truncate group-hover:text-ember-700 dark:group-hover:text-ember-300 transition-colors motion-reduce:transition-none"
          >
            {batch.name}
          </h3>
          <div className="flex items-center gap-2 mt-1 min-w-0">
            <span title={agentName} className="text-xs text-muted-foreground truncate">
              {agentName}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted shrink-0" aria-hidden="true" />
            <time
              dateTime={batch.created_at}
              title={batch.created_at}
              className="text-xs text-muted-foreground tabular-nums shrink-0"
            >
              {timeAgo(batch.created_at)}
            </time>
          </div>
        </div>
      </Link>

      {/* Status */}
      <div className="lg:col-span-2 flex lg:block items-center min-w-0">
        <BatchStatusBadge status={batch.status} />
      </div>

      {/* Progress from real stats only */}
      <div className="lg:col-span-3 min-w-0">
        <div className="flex items-center gap-3">
          <ProgressBar value={progress} />
          <span
            title={`${done} of ${batch.stats.total} calls done (${progress}%)`}
            className="text-xs font-mono text-muted-foreground shrink-0 tabular-nums"
          >
            {done}/{batch.stats.total}
          </span>
        </div>
        <p title={`${batch.stats.completed} completed · ${batch.stats.failed} failed · ${batch.stats.queued} queued`} className="mt-1.5 text-[11px] font-mono text-muted-foreground truncate tabular-nums">
          {batch.stats.completed} done · {batch.stats.failed} failed · {batch.stats.queued} queued
        </p>
      </div>

      {/* Schedule / calling hours */}
      <div className="lg:col-span-2 min-w-0">
        <p title={schedule.title} className="text-xs font-mono text-muted-foreground truncate tabular-nums">
          {schedule.label}
        </p>
        <p title={batch.batch_id} className="mt-1 text-[10px] font-mono text-muted-foreground truncate opacity-80 tabular-nums">
          {batch.batch_id.slice(0, 8)}… · {batch.stats.total} recipients
        </p>
      </div>

      {/* Actions: open / retry / delete (two-step, agents pattern) */}
      <div className="lg:col-span-1 flex items-center justify-end gap-1 min-w-0">
        {batch.stats.failed > 0 &&
          (canWrite ? (
            <button
              onClick={handleRetry}
              disabled={busy}
              aria-label={`Retry ${batch.stats.failed} failed calls in ${batch.name}`}
              title={`Retry ${batch.stats.failed} failed`}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </button>
          ) : (
            <span
              title={`Requires ${minRoleFor("batches.write")} role`}
              aria-label="Retry unavailable for your role"
              className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center text-muted-foreground/40 cursor-not-allowed"
            >
              <RotateCcw className="w-4 h-4" aria-hidden="true" />
            </span>
          ))}
        {confirming ? (
          <span className="flex items-center gap-1">
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              aria-label={`Confirm delete ${batch.name}`}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            >
              <Check className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={() => setConfirming(false)}
              aria-label="Cancel delete"
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          </span>
        ) : canWrite ? (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${batch.name}`}
            title="Delete"
            className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </button>
        ) : (
          <span
            title={`Requires ${minRoleFor("batches.write")} role`}
            aria-label="Delete unavailable for your role"
            className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center text-muted-foreground/40 cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" aria-hidden="true" />
          </span>
        )}
        <Link
          href={detailHref}
          aria-label={`Open ${batch.name}`}
          title="Open campaign"
          className={cn(
            "w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          )}
        >
          <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  );
});
