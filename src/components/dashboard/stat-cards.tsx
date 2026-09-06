"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { useAgents } from "@/services/api";
import type { Execution } from "@/lib/schemas/platform";
import { formatLatency } from "@/lib/format";
import { avgStageMs, binCounts, completionStats, p95E2E, trendPercent, type RangeKey } from "@/lib/stats";
import { Sparkline } from "./sparkline";
import { cn } from "@/lib/utils";

function TrendPill({ value }: { value: number | null }) {
  if (value === null) return null;
  const positive = value >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono",
        positive
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-red-500/10 text-red-700 dark:text-red-400"
      )}
    >
      {positive ? "▲" : "▼"} {positive ? "+" : ""}
      {value.toFixed(1)}%
    </span>
  );
}

function Card({
  title,
  badge,
  children,
  delay = 0,
}: {
  title: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="rounded-3xl border border-border bg-card p-5 flex flex-col gap-2 min-w-0"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate">{title}</p>
        {badge}
      </div>
      {children}
    </motion.div>
  );
}

function BigValue({ value }: { value: string }) {
  return (
    <motion.p
      key={value}
      initial={{ opacity: 0.35 }}
      animate={{ opacity: 1 }}
      className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground tabular-nums"
    >
      {value}
    </motion.p>
  );
}

export function StatCards({
  current,
  previous,
  range,
  rangeMs,
}: {
  current: Execution[];
  previous: Execution[];
  range: RangeKey;
  rangeMs: number;
}) {
  const { data: agents } = useAgents();

  const bins = useMemo(
    () => binCounts(current, rangeMs, 24),
    [current, rangeMs]
  );
  const completion = useMemo(() => completionStats(current), [current]);
  const stages = useMemo(() => avgStageMs(current), [current]);
  const p95 = useMemo(() => p95E2E(current), [current]);
  const volumeTrend = trendPercent(current.length, previous.length);

  const activeAgents = useMemo(() => {
    const ids = new Set(current.map((e) => e.agent_id));
    return { active: ids.size, total: agents?.length ?? 0 };
  }, [current, agents]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" role="region" aria-label="Range statistics">
      <Card title="Total calls" badge={<TrendPill value={volumeTrend} />} delay={0}>
        <BigValue value={current.length.toLocaleString()} />
        <p className="text-xs text-muted-foreground">Volume in range</p>
        <div className="mt-1 -mb-1">
          <Sparkline values={bins.map((b) => b.count)} label={`Call volume, ${range}`} />
        </div>
      </Card>

      <Card title="P95 E2E latency" delay={0.05}>
        <BigValue value={formatLatency(p95)} />
        <p className="text-xs text-muted-foreground tabular-nums">
          STT {formatLatency(stages.stt !== null ? Math.round(stages.stt) : null)}
          {" · "}
          TTS {formatLatency(stages.tts !== null ? Math.round(stages.tts) : null)}
        </p>
      </Card>

      <Card title="Completion rate" delay={0.1}>
        <BigValue
          value={completion.completedRate === null ? "—" : `${(completion.completedRate * 100).toFixed(1)}%`}
        />
        <p className="text-xs text-muted-foreground tabular-nums">
          {completion.failedRate === null
            ? "No calls in range"
            : `${(completion.failedRate * 100).toFixed(1)}% failed`}
        </p>
      </Card>

      <Card title="Active fleet" delay={0.15}>
        <BigValue
          value={`${activeAgents.active} / ${activeAgents.total}`}
        />
        <p className="text-xs text-muted-foreground">Agents with calls in range</p>
      </Card>
    </div>
  );
}
