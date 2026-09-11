"use client";

import { memo, useMemo } from "react";
import { Activity } from "lucide-react";
import { formatLatency } from "@/lib/format";
import { useLatencyStats } from "@/services/platform/executions";
import { cn } from "@/lib/utils";
import type { LatencyStats } from "@/lib/schemas/builders";

const STAGE_META = [
  {
    key: "stt",
    label: "STT",
    full: "Transcriber",
    aliases: ["transcriber_ms", "transcriber", "stt"],
    barClass: "bg-sky-500",
    dotClass: "bg-sky-500",
  },
  {
    key: "llm",
    label: "LLM",
    full: "LLM",
    aliases: ["llm_ms", "llm"],
    barClass: "bg-primary",
    dotClass: "bg-primary",
  },
  {
    key: "tts",
    label: "TTS",
    full: "Synthesizer",
    aliases: ["synthesizer_ms", "synthesizer", "tts"],
    barClass: "bg-emerald-500",
    dotClass: "bg-emerald-500",
  },
] as const;

function stageValue(byStage: Record<string, number>, aliases: readonly string[]): number | null {
  for (const key of aliases) {
    const value = byStage[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

export const LatencyInsights = memo(function LatencyInsights({
  agent_id,
  days = 30,
  stats: statsProp,
  isLoading: isLoadingProp,
}: {
  agent_id?: string;
  days?: number;
  stats?: LatencyStats | null;
  isLoading?: boolean;
}) {
  const { data: statsFallback, isLoading: isLoadingFallback, isError } = useLatencyStats(agent_id, days);
  const stats = statsProp !== undefined ? statsProp : statsFallback;
  const isLoading = isLoadingProp ?? isLoadingFallback;

  const stages = useMemo(
    () =>
      stats
        ? STAGE_META.map((meta) => ({ ...meta, ms: stageValue(stats.by_stage, meta.aliases) }))
        : [],
    [stats]
  );
  const stageTotal = stages.reduce((sum, stage) => sum + (stage.ms ?? 0), 0);

  if (isLoading) {
    return <div className="h-28 rounded-[2rem] bg-card border border-border animate-pulse motion-reduce:animate-none" aria-hidden="true" />;
  }
  if (isError || !stats || stats.count === 0) return null;

  const slowest = [...stages].sort((a, b) => (b.ms ?? -1) - (a.ms ?? -1))[0];
  const slowestLabel =
    slowest?.ms != null ? `${slowest.label} · ${formatLatency(slowest.ms)}` : "—";
  const maxBucket = Math.max(...stats.buckets.map((bucket) => bucket.avg_e2e_ms ?? 0), 1);

  return (
    <div className="rounded-[2rem] border border-border bg-card p-5 min-w-0">
      <div className="flex flex-wrap items-start gap-2 mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <Activity className="w-4 h-4 text-ember-700 dark:text-ember-300 shrink-0" aria-hidden="true" />
          <h3 className="text-sm font-medium text-foreground truncate">
            Latency Observability &amp; Stage Breakdown
          </h3>
        </div>
        <span className="text-xs font-mono text-muted-foreground ml-auto px-3 py-1 rounded-full border border-border bg-muted/50 tabular-nums shrink-0">
          {stats.count} sampled calls · last {days} days
        </span>
      </div>
      <p className="text-xs font-mono text-muted-foreground mb-4">
        Measured end-to-end timings across sampled executions — no estimates.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        {[
          { label: "Average E2E", value: formatLatency(stats.avg_e2e_ms), critical: false },
          { label: "p50 Median", value: formatLatency(stats.p50_e2e_ms), critical: false },
          { label: "p95 Tail", value: formatLatency(stats.p95_e2e_ms), critical: false },
          { label: "Critical Bottleneck", value: slowestLabel, critical: true },
        ].map((metric) => (
          <div key={metric.label} className="min-w-0">
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate">
              {metric.label}
            </p>
            <p
              className={cn(
                "text-xl font-semibold tracking-tight mt-0.5 truncate tabular-nums",
                metric.critical ? "text-red-600 dark:text-red-400" : "text-foreground"
              )}
              title={metric.value}
            >
              {metric.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-3" aria-label="Stage legend">
        {STAGE_META.map((meta) => (
          <span key={meta.key} className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className={cn("w-2 h-2 rounded-full shrink-0", meta.dotClass)} aria-hidden="true" />
            {meta.label} · {meta.full}
          </span>
        ))}
      </div>

      {stageTotal > 0 ? (
        <div className="space-y-2.5" role="img" aria-label={`Stage share across ${stats.count} sampled calls`}>
          <div className="flex h-2.5 rounded-full overflow-hidden bg-muted" aria-hidden="true">
            {stages.map((stage) => (
              <div
                key={stage.key}
                title={`${stage.label} ${formatLatency(stage.ms)}`}
                className={cn("h-full", stage.barClass)}
                style={{ width: `${((stage.ms ?? 0) / stageTotal) * 100}%` }}
              />
            ))}
          </div>
          {stages.map((stage) => (
            <div key={stage.key} className="flex items-center gap-3 min-w-0">
              <span className="w-28 shrink-0 text-xs text-muted-foreground truncate">
                {stage.label} · {stage.full}
              </span>
              <div className="flex-1 min-w-0 h-1.5 rounded-full bg-muted overflow-hidden" aria-hidden="true">
                <div
                  className={cn("h-full rounded-full", stage.barClass)}
                  style={{ width: `${((stage.ms ?? 0) / stageTotal) * 100}%` }}
                />
              </div>
              <span className="w-16 shrink-0 text-right text-xs font-mono text-foreground tabular-nums">
                {formatLatency(stage.ms)}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs font-mono text-muted-foreground">No stage timing data in this window.</p>
      )}

      {stats.buckets.length > 1 && (
        <div className="mt-5">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Daily average E2E
          </p>
          <div className="flex items-end gap-1.5 h-16" role="img" aria-label={`Daily average latency chart across ${stats.count} calls`}>
            {stats.buckets.map((bucket) => (
              <div
                key={`${bucket.date}-${bucket.count}`}
                title={`${bucket.date}: ${formatLatency(bucket.avg_e2e_ms)} across ${bucket.count} calls`}
                className="flex-1 rounded-t-md bg-gradient-to-t from-ember-700/60 to-primary dark:from-ember-400/50 dark:to-ember-300/80 min-h-[4px] transition-all motion-reduce:transition-none"
                style={{ height: `${Math.max(6, ((bucket.avg_e2e_ms ?? 0) / maxBucket) * 100)}%` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
