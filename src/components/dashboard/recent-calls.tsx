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
            View full logs <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-8 text-center">
          No traces match this filter.
        </p>
      ) : (
        <div className="rounded-3xl border border-border overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 gap-4 px-6 py-3 bg-muted/40 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
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
              className={`grid grid-cols-2 lg:grid-cols-12 gap-2 lg:gap-4 lg:items-center p-4 lg:px-6 bg-card min-w-0 ${
                index > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="col-span-2 lg:col-span-2 font-mono text-xs text-muted-foreground truncate min-w-0">
                {new Date(execution.started_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
              <span className="col-span-2 lg:col-span-3 font-mono text-sm text-foreground truncate min-w-0" title={execution.to_number ?? undefined}>
                {execution.to_number ?? "—"}
              </span>
              <span className="col-span-2 lg:col-span-3 font-mono text-xs text-ember-700 dark:text-ember-300 truncate min-w-0" title={agentNames.get(execution.agent_id) ?? execution.agent_id}>
                {agentLabel(execution.agent_id, agentNames.get(execution.agent_id))}
              </span>
              <span className="col-span-1 lg:col-span-1 min-w-0">
                <StatusBadge status={execution.status} />
              </span>
              <span className="col-span-2 lg:col-span-2 text-xs font-mono text-muted-foreground truncate min-w-0">
                {formatDuration(execution.duration_s)} ({formatLatency(execution.latency?.e2e_ms)})
              </span>
              <span className="col-span-2 lg:col-span-1 lg:text-right min-w-0">
                <button
                  onClick={() => setInspectedId(execution.execution_id)}
                  className="text-xs font-mono text-ember-700 dark:text-ember-300 hover:underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
                >
                  Inspect
                </button>
              </span>
              <span className="col-span-2 lg:hidden text-[11px] font-mono text-muted-foreground truncate">
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
