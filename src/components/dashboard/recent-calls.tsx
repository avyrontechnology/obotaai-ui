"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { ExecutionDrawer } from "@/components/calls/execution-drawer";
import { StatusBadge } from "@/components/calls/status-badge";
import { SearchInput } from "@/components/common/search-input";
import { agentLabel } from "@/lib/stats";
import { formatDuration, formatLatency, timeAgo } from "@/lib/format";
import { useAgents } from "@/services/api";
import type { Execution } from "@/lib/schemas/platform";

/** Telemetry traces for the selected range: filter + inspect in place. */
export function RecentCalls({ executions }: { executions: Execution[] }) {
  const { data: agents } = useAgents();
  const [query, setQuery] = useState("");
  const [inspectedId, setInspectedId] = useState<string | null>(null);

  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.agent_id, agent.agent_name));
    return map;
  }, [agents]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = [...executions].sort(
      (a, b) => +new Date(b.started_at) - +new Date(a.started_at)
    );
    if (!needle) return sorted.slice(0, 8);
    return sorted
      .filter(
        (execution) =>
          (execution.to_number ?? "").toLowerCase().includes(needle) ||
          execution.execution_id.toLowerCase().includes(needle) ||
          (agentNames.get(execution.agent_id) ?? "").toLowerCase().includes(needle) ||
          execution.status.toLowerCase().includes(needle)
      )
      .slice(0, 8);
  }, [executions, query, agentNames]);

  if (executions.length === 0) return null;

  return (
    <section aria-label="Recent telemetry traces" className="flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">Recent Telemetry Traces</h2>
          <p className="text-sm text-muted-foreground font-mono mt-0.5">
            {filtered.length} shown · newest first
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Filter traces..."
            label="Filter traces"
          />
          <Link
            href="/calls"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            View full logs <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-8 text-center">
          No traces match this filter.
        </p>
      ) : (
        <div className="rounded-3xl border border-border overflow-hidden">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-muted/40 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="col-span-2">Timestamp</div>
            <div className="col-span-3">Caller</div>
            <div className="col-span-3">Agent</div>
            <div className="col-span-1">Outcome</div>
            <div className="col-span-2">Duration / latency</div>
            <div className="col-span-1 text-right">Trace</div>
          </div>
          {filtered.map((execution, index) => (
            <div
              key={execution.execution_id}
              className={`grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4 md:items-center p-4 md:px-6 bg-card ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="col-span-2 md:col-span-2 font-mono text-xs text-muted-foreground">
                {new Date(execution.started_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="col-span-2 md:col-span-3 font-mono text-sm text-foreground truncate">
                {execution.to_number ?? "—"}
              </span>
              <span className="col-span-2 md:col-span-3 font-mono text-xs text-ember-700 dark:text-ember-300 truncate">
                {agentLabel(execution.agent_id, agentNames.get(execution.agent_id))}
              </span>
              <span className="col-span-1 md:col-span-1">
                <StatusBadge status={execution.status} />
              </span>
              <span className="col-span-2 md:col-span-2 text-xs font-mono text-muted-foreground">
                {formatDuration(execution.duration_s)} ({formatLatency(execution.latency?.e2e_ms)})
              </span>
              <span className="col-span-2 md:col-span-1 md:text-right">
                <button
                  onClick={() => setInspectedId(execution.execution_id)}
                  className="text-xs font-mono text-ember-700 dark:text-ember-300 hover:underline underline-offset-4"
                >
                  Inspect
                </button>
              </span>
              <span className="col-span-2 md:hidden text-[11px] font-mono text-muted-foreground">
                {timeAgo(execution.started_at)}
              </span>
            </div>
          ))}
        </div>
      )}

      <ExecutionDrawer executionId={inspectedId} onClose={() => setInspectedId(null)} />
    </section>
  );
}
