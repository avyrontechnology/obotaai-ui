"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock3, PhoneCall } from "lucide-react";
import { formatLatency } from "@/lib/format";
import { avgStageMs, completionStats, p95E2E } from "@/lib/stats";
import { useLatencyStats, useExecutionStats } from "@/services/platform/executions";
import { cn } from "@/lib/utils";
import type { Execution } from "@/lib/schemas/platform";

function Card({
  title,
  icon: Icon,
  children,
  delay = 0,
}: {
  title: string;
  icon: typeof Activity;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay }}
      className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-2 min-w-0"
    >
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-3.5 h-3.5" />
        <p className="text-[11px] font-mono uppercase tracking-widest truncate">{title}</p>
      </div>
      {children}
    </motion.div>
  );
}

function BigValue({ value }: { value: string }) {
  return (
    <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{value}</p>
  );
}

export function CallsKpiStrip({
  executions,
  agentId,
}: {
  executions: Execution[];
  agentId?: string;
}) {
  const { data: stats, isLoading: statsLoading } = useExecutionStats(agentId);
  const { data: latency, isLoading: latencyLoading } = useLatencyStats(agentId);

  const completion = useMemo(() => completionStats(executions), [executions]);
  const stages = useMemo(() => avgStageMs(executions), [executions]);
  const p95 = useMemo(() => p95E2E(executions), [executions]);

  const totalLabel = stats ? stats.total.toLocaleString() : executions.length.toLocaleString();
  const totalCaption = stats
    ? `${stats.by_status["completed"] ?? 0} completed · ${stats.by_status["failed"] ?? 0} failed`
    : completion.failedRate === null
      ? "No calls in page"
      : `${(completion.failedRate * 100).toFixed(1)}% failed in page`;

  // Per-card skeletons — no blanket hide that causes layout jolts. Null stats + empty page still hides strip (empty state owns page).
  const showTotalSkeleton = statsLoading;
  const showLatencySkeletons = latencyLoading;
  const hideStrip = !stats && executions.length === 0 && !latency && !statsLoading && !latencyLoading;
  if (hideStrip) return null;

  const completionValue =
    stats
      ? `${(stats.completed_rate * 100).toFixed(1)}%`
      : completion.completedRate === null
        ? "—"
        : `${(completion.completedRate * 100).toFixed(1)}%`;

  const slowestStage = latency
    ? Object.entries(latency.by_stage).sort((a, b) => b[1] - a[1])[0]
    : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6" role="region" aria-label="Call statistics">
      <Card title="Total calls" icon={PhoneCall} delay={0}>
        {showTotalSkeleton ? (
          <div className="h-7 w-20 rounded bg-muted animate-pulse" />
        ) : (
          <BigValue value={totalLabel} />
        )}
        <p className={cn("text-xs tabular-nums", "text-muted-foreground")}>
          {showTotalSkeleton ? <span className="inline-block h-3 w-28 rounded bg-muted animate-pulse" /> : totalCaption}
        </p>
      </Card>

      <Card title="Completion rate" icon={CheckCircle2} delay={0.05}>
        {showTotalSkeleton ? (
          <div className="h-7 w-16 rounded bg-muted animate-pulse" />
        ) : (
          <BigValue value={completionValue} />
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {showTotalSkeleton ? (
            <span className="inline-block h-3 w-32 rounded bg-muted animate-pulse" />
          ) : stats ? (
            `${latency?.count ?? executions.length} in latency window`
          ) : executions.length === 0 ? (
            "No calls in page"
          ) : (
            `${completion.completed} / ${completion.total} completed in page`
          )}
        </p>
      </Card>

      <Card title="P95 E2E latency" icon={Clock3} delay={0.1}>
        {showLatencySkeletons ? (
          <div className="h-7 w-16 rounded bg-muted animate-pulse" />
        ) : (
          <BigValue value={formatLatency(p95 ?? latency?.p95_e2e_ms ?? null)} />
        )}
        <p className="text-xs text-muted-foreground tabular-nums">
          {showLatencySkeletons ? (
            <span className="inline-block h-3 w-24 rounded bg-muted animate-pulse" />
          ) : (
            <>
              STT {formatLatency(stages.stt !== null ? Math.round(stages.stt) : (latency?.by_stage["transcriber_ms"] ?? null))} · TTS{" "}
              {formatLatency(stages.tts !== null ? Math.round(stages.tts) : (latency?.by_stage["synthesizer_ms"] ?? null))}
            </>
          )}
        </p>
      </Card>

      <Card title="Slowest stage" icon={Activity} delay={0.15}>
        {showLatencySkeletons ? (
          <div className="h-7 w-24 rounded bg-muted animate-pulse" />
        ) : (
          <BigValue
            value={
              slowestStage ? `${({ transcriber_ms: "STT", llm_ms: "LLM", synthesizer_ms: "TTS" }[slowestStage[0]] ?? slowestStage[0])} · ${formatLatency(slowestStage[1])}` : "—"
            }
          />
        )}
        <p className="text-xs text-muted-foreground">
          {showLatencySkeletons ? (
            <span className="inline-block h-3 w-28 rounded bg-muted animate-pulse" />
          ) : latency ? (
            `${latency.count} calls · last 30 days`
          ) : (
            "No latency data"
          )}
        </p>
      </Card>
    </div>
  );
}
