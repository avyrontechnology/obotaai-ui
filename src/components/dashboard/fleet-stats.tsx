"use client";

import { Activity, CheckCircle2, PhoneCall, Server } from "lucide-react";
import { StatCard } from "@/components/common/stat-card";
import { formatLatency } from "@/lib/format";
import { useAgents } from "@/services/api";
import { useExecutionStats } from "@/services/platform/executions";

/** Live fleet metrics. Shows placeholders until the platform API responds. */
export function FleetStats() {
  const { data: stats, isLoading: statsLoading } = useExecutionStats();
  const { data: agents, isLoading: agentsLoading } = useAgents();

  const loading = statsLoading || agentsLoading;
  const value = (text: string) => (loading ? "—" : text);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        title="Total Calls"
        value={value(String(stats?.total ?? 0))}
        icon={<PhoneCall className="h-4 w-4 text-muted-foreground" />}
        delay={0.1}
        className="border-border bg-card"
      />
      <StatCard
        title="Avg E2E Latency"
        value={value(formatLatency(stats?.avg_e2e_ms ?? null))}
        icon={<Activity className="h-4 w-4 text-muted-foreground" />}
        delay={0.2}
        className="border-border bg-card"
      />
      <StatCard
        title="Completion Rate"
        value={value(`${Math.round((stats?.completed_rate ?? 0) * 100)}%`)}
        icon={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
        delay={0.3}
        className="border-border bg-card"
      />
      <StatCard
        title="Active Agents"
        value={value(String(agents?.length ?? 0))}
        icon={<Server className="h-4 w-4 text-muted-foreground" />}
        delay={0.4}
        className="border-border bg-card"
      />
    </div>
  );
}
