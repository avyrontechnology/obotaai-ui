"use client";

import { memo, useMemo } from "react";
import { motion } from "framer-motion";
import { Activity, CheckCircle2, Clock3, PhoneCall } from "lucide-react";
import { formatDuration, formatLatency } from "@/lib/format";
import { avgStageMs, completionStats, p95E2E } from "@/lib/stats";
import { useLatencyStats, useExecutionStats } from "@/services/platform/executions";
import { cn } from "@/lib/utils";
import type { Execution } from "@/lib/schemas/platform";
import type { LatencyStats } from "@/lib/schemas/builders";
import type { ExecutionStats } from "@/lib/schemas/platform";

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
    <p className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground tabular-nums truncate" title={value}>{value}</p>
  );
}

/**
 * Defensive stage lookup. The latency summary reports averages keyed by
 * pipeline stage, but key spellings vary across backends — accept every
 * known alias and tolerate missing keys (null = no data, never a guess).
 */
const STT_KEYS = ["transcriber_ms", "transcriber", "stt"];
const LLM_KEYS = ["llm_ms", "llm"];
const TTS_KEYS = ["synthesizer_ms", "synthesizer", "tts"];
const STAGE_SHORT_NAMES: Record<string, string> = {
  transcriber_ms: "STT",
  transcriber: "STT",
  stt: "STT",
  llm_ms: "LLM",
  llm: "LLM",
  synthesizer_ms: "TTS",
  synthesizer: "TTS",
  tts: "TTS",
};

function stageValue(byStage: Record<string, number>, aliases: string[]): number | null {
  for (const key of aliases) {
    const value = byStage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export const CallsKpiStrip = memo(function CallsKpiStrip({
  executions,
  agentId,
  stats: statsProp,
  latency: latencyProp,
  statsLoading: statsLoadingProp,
  latencyLoading: latencyLoadingProp,
  scopeNote,
}: {
  executions: Execution[];
  agentId?: string;
  stats?: ExecutionStats | null;
  latency?: LatencyStats | null;
  statsLoading?: boolean;
  latencyLoading?: boolean;
  /** Extra scope qualifier, e.g. batch-filtered views whose totals are global. */
  scopeNote?: string;
}) {
  const { data: statsFallback, isLoading: statsLoadingFallback } = useExecutionStats(agentId);
  const { data: latencyFallback, isLoading: latencyLoadingFallback } = useLatencyStats(agentId);
  const stats = statsProp !== undefined ? statsProp : statsFallback;
  const latency = latencyProp !== undefined ? latencyProp : latencyFallback;
  const statsLoading = statsLoadingProp ?? statsLoadingFallback;
  const latencyLoading = latencyLoadingProp ?? latencyLoadingFallback;

  const completion = useMemo(() => completionStats(executions), [executions]);
  const stages = useMemo(() => avgStageMs(executions), [executions]);
  const pageP95 = useMemo(() => p95E2E(executions), [executions]);
  const slowestStage = useMemo(() => {
    if (!latency) return null;
    let best: [string, number] | null = null;
    for (const [key, value] of Object.entries(latency.by_stage)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      if (!best || value > best[1]) best = [key, value];
    }
    return best;
  }, [latency]);
  // Server windowed p95 is statistically meaningful; the 25-row page slice
  // is only a fallback when the latency summary is unavailable.
  const p95 = latency?.p95_e2e_ms ?? pageP95;

  const totalLabel = stats ? stats.total.toLocaleString() : executions.length.toLocaleString();
  const totalCaption = stats
    ? `${stats.by_status["completed"] ?? 0} completed · ${stats.by_status["failed"] ?? 0} failed${scopeNote ? ` · ${scopeNote}` : ""}`
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

  // Per-call stage averages first, latency-summary by_stage as fallback.
  // Both paths tolerate missing keys — unknown stages render "—".
  const sttMs =
    stages.stt !== null ? Math.round(stages.stt) : latency ? stageValue(latency.by_stage, STT_KEYS) : null;
  const llmMs =
    stages.llm !== null ? Math.round(stages.llm) : latency ? stageValue(latency.by_stage, LLM_KEYS) : null;
  const ttsMs =
    stages.tts !== null ? Math.round(stages.tts) : latency ? stageValue(latency.by_stage, TTS_KEYS) : null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6" role="region" aria-label="Call statistics">
      <Card title="Total calls" icon={PhoneCall} delay={0}>
        {showTotalSkeleton ? (
          <div className="h-7 w-20 rounded bg-muted animate-pulse" />
        ) : (
          <BigValue value={totalLabel} />
        )}
        <p className={cn("text-xs tabular-nums truncate", "text-muted-foreground")} title={typeof totalCaption === "string" ? totalCaption : undefined}>
          {showTotalSkeleton ? <span className="inline-block h-3 w-28 rounded bg-muted animate-pulse" /> : totalCaption}
        </p>
      </Card>

      <Card title="Completion rate" icon={CheckCircle2} delay={0.05}>
        {showTotalSkeleton ? (
          <div className="h-7 w-16 rounded bg-muted animate-pulse" />
        ) : (
          <BigValue value={completionValue} />
        )}
        <p className="text-xs text-muted-foreground tabular-nums truncate">
          {showTotalSkeleton ? (
            <span className="inline-block h-3 w-32 rounded bg-muted animate-pulse" />
          ) : stats ? (
            `${formatDuration(stats.total_duration_s)} total duration`
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
          <BigValue value={formatLatency(p95)} />
        )}
        <p className="text-xs text-muted-foreground tabular-nums truncate">
          {showLatencySkeletons ? (
            <span className="inline-block h-3 w-24 rounded bg-muted animate-pulse" />
          ) : (
            <>
              STT {formatLatency(sttMs)} · LLM{" "}
              {formatLatency(llmMs)} · TTS{" "}
              {formatLatency(ttsMs)}
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
              slowestStage ? `${STAGE_SHORT_NAMES[slowestStage[0]] ?? slowestStage[0]} · ${formatLatency(slowestStage[1])}` : "—"
            }
          />
        )}
        <p className="text-xs text-muted-foreground truncate">
          {showLatencySkeletons ? (
            <span className="inline-block h-3 w-28 rounded bg-muted animate-pulse" />
          ) : latency ? (
            `${latency.count} sampled calls`
          ) : (
            "No latency data"
          )}
        </p>
      </Card>
    </div>
  );
});
