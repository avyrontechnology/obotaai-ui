"use client";

import { useEffect, useMemo, useState } from "react";
import { AgentGrid } from "@/components/dashboard/agent-grid";
import { GettingStarted } from "@/components/dashboard/getting-started";
import { RecentCalls } from "@/components/dashboard/recent-calls";
import { StatCards } from "@/components/dashboard/stat-cards";
import { SectionHeader } from "@/components/common/section-header";
import { isTerminal } from "@/components/calls/status-badge";
import { useExecutions } from "@/services/platform/executions";
import { RANGE_LABEL, RANGE_MS, splitWindows, type RangeKey } from "@/lib/stats";
import { cn } from "@/lib/utils";

const RANGES: RangeKey[] = ["live", "1h", "24h", "7d"];

export default function Home() {
  const [range, setRange] = useState<RangeKey>("24h");
  // Wide fetch so range windows have real history behind them.
  const { data: executions, refetch } = useExecutions({ limit: 500 });

  const hasActive = useMemo(
    () => (executions ?? []).some((execution) => !isTerminal(execution.status)),
    [executions]
  );

  // Live-tail while calls are running; settle otherwise.
  useEffect(() => {
    if (range !== "live" && !hasActive) return;
    const timer = setInterval(() => refetch(), 4000);
    return () => clearInterval(timer);
  }, [range, hasActive, refetch]);

  const { current, previous } = useMemo(
    () => splitWindows(executions ?? [], RANGE_MS[range]),
    [executions, range]
  );

  return (
    <div className="flex flex-col flex-1 min-h-full max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 gap-8 md:gap-10">

      {/* Command Hero & System Status */}
      <section className="flex flex-col gap-6 mt-4">
        <div className="flex items-center gap-3">
          <div className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
          </div>
          <p className="text-sm font-mono font-medium text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">
            Matrix Online • All systems nominal
          </p>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <SectionHeader
            title={<span className="text-3xl md:text-4xl text-foreground">Command Center</span>}
            description="Global overview of your neural fleet and conversational metrics."
            className="!mb-2"
          />
          <div className="flex items-center gap-1 p-1 rounded-2xl border border-border bg-card shrink-0" role="tablist" aria-label="Time range">
            {RANGES.map((option) => (
              <button
                key={option}
                onClick={() => setRange(option)}
                role="tab"
                aria-selected={range === option}
                className={cn(
                  "px-4 h-9 rounded-xl text-sm font-mono transition-colors",
                  range === option
                    ? "bg-primary text-primary-foreground font-semibold shadow"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {RANGE_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics Row */}
        <StatCards current={current} previous={previous} range={range} rangeMs={RANGE_MS[range]} />
      </section>

      <GettingStarted />

      <RecentCalls executions={current} />

      {/* Agent Fleet */}
      <section className="flex flex-col">
        <AgentGrid />
      </section>

    </div>
  );
}
