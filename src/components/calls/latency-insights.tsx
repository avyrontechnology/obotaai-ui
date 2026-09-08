"use client";

import { memo } from "react";
import { Activity } from "lucide-react";
import { formatLatency } from "@/lib/format";
import { useLatencyStats } from "@/services/platform/executions";
import type { LatencyStats } from "@/lib/schemas/builders";

const STAGE_LABELS: Record<string, string> = {
  transcriber_ms: "STT",
  llm_ms: "LLM",
  synthesizer_ms: "TTS",
};

export const LatencyInsights = memo(function LatencyInsights({
  agent_id,
  stats: statsProp,
  isLoading: isLoadingProp,
}: {
  agent_id?: string;
  stats?: LatencyStats | null;
  isLoading?: boolean;
}) {
  const { data: statsFallback, isLoading: isLoadingFallback, isError } = useLatencyStats(agent_id);
  const stats = statsProp !== undefined ? statsProp : statsFallback;
  const isLoading = isLoadingProp ?? isLoadingFallback;

  if (isLoading) {
    return <div className="h-28 rounded-[2rem] bg-card border border-border animate-pulse motion-reduce:animate-none mb-6" aria-hidden="true" />;
  }
  if (isError || !stats || stats.count === 0) return null;

  const maxBucket = Math.max(...stats.buckets.map((bucket) => bucket.avg_e2e_ms ?? 0), 1);
  const slowestStage = Object.entries(stats.by_stage).sort((a, b) => b[1] - a[1])[0];

  return (
    <div className="rounded-[2rem] border border-border bg-card p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-ember-700 dark:text-ember-300" />
        <h3 className="text-sm font-medium text-foreground">Latency observability</h3>
        <span className="text-xs font-mono text-muted-foreground ml-auto">
          {stats.count} calls · last 30 days
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        {[
          { label: "Average E2E", value: formatLatency(stats.avg_e2e_ms) },
          { label: "p50 E2E", value: formatLatency(stats.p50_e2e_ms) },
          { label: "p95 E2E", value: formatLatency(stats.p95_e2e_ms) },
          {
            label: "Slowest stage",
            value: slowestStage
              ? `${STAGE_LABELS[slowestStage[0]] ?? slowestStage[0]} · ${formatLatency(slowestStage[1])}`
              : "—",
          },
        ].map((metric) => (
          <div key={metric.label}>
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{metric.label}</p>
            <p className="text-xl font-semibold tracking-tight text-foreground mt-0.5">{metric.value}</p>
          </div>
        ))}
      </div>

      {stats.buckets.length > 1 && (
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
      )}
    </div>
  );
});
