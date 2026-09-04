"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight } from "lucide-react";
import { StatusBadge } from "@/components/calls/status-badge";
import { formatDuration, timeAgo } from "@/lib/format";
import { useAgents } from "@/services/api";
import { useExecutions } from "@/services/platform/executions";

export function RecentCalls() {
  const { data: executions } = useExecutions();
  const { data: agents } = useAgents();

  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.agent_id, agent.agent_name));
    return map;
  }, [agents]);

  const recent = (executions ?? []).slice(0, 5);
  if (recent.length === 0) return null;

  return (
    <section aria-label="Recent calls" className="flex flex-col">
      <div className="flex items-end justify-between mb-4">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Recent calls</h2>
        <Link
          href="/calls"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          View all <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
      <div className="rounded-[2rem] border border-border overflow-hidden">
        {recent.map((execution, index) => (
          <Link
            key={execution.execution_id}
            href="/calls"
            className={`grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4 md:items-center p-4 md:px-6 bg-card transition-colors hover:bg-muted/60 ${
              index > 0 ? "border-t border-border" : ""
            }`}
          >
            <span className="col-span-1 md:col-span-4 font-mono text-sm text-foreground truncate">
              {execution.to_number}
            </span>
            <span className="col-span-1 md:col-span-4 text-sm text-muted-foreground truncate">
              {agentNames.get(execution.agent_id) ?? `${execution.agent_id.slice(0, 8)}…`}
            </span>
            <span className="col-span-1 md:col-span-2">
              <StatusBadge status={execution.status} />
            </span>
            <span className="col-span-1 md:col-span-2 text-xs font-mono text-muted-foreground md:text-right">
              {formatDuration(execution.duration_s)} · {timeAgo(execution.started_at)}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
