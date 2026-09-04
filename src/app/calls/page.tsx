"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, Download, PhoneCall, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ExecutionDrawer } from "@/components/calls/execution-drawer";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { SkeletonList } from "@/components/common/skeleton-list";
import { ErrorState } from "@/components/common/error-state";
import { LatencyInsights } from "@/components/calls/latency-insights";
import { StatusBadge, isTerminal } from "@/components/calls/status-badge";
import { downloadCsv, executionsToCsv } from "@/lib/calls-export";
import { formatDuration, formatLatency, timeAgo } from "@/lib/format";
import { useAgents } from "@/services/api";
import { useExecutions } from "@/services/platform/executions";
import type { Execution } from "@/lib/schemas/platform";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "completed", label: "Completed" },
  { value: "in_progress", label: "In progress" },
  { value: "ringing", label: "Ringing" },
  { value: "queued", label: "Queued" },
  { value: "failed", label: "Failed" },
  { value: "no-answer", label: "No answer" },
  { value: "busy", label: "Busy" },
  { value: "canceled", label: "Canceled" },
];

const selectClass =
  "h-11 px-4 bg-card border border-border rounded-2xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 transition-all";

export default function CallsPage() {
  return (
    <Suspense>
      <CallsContent />
    </Suspense>
  );
}

function CallsContent() {
  const searchParams = useSearchParams();
  const batchId = searchParams.get("batch_id");
  const deepLinkedAgent = searchParams.get("agent");
  // ?agent= from the agent overview prefills the filter. Manual selection
  // overrides it — derived, no effect-driven setState.
  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  const agentFilter = agentOverride ?? deepLinkedAgent ?? "all";
  const setAgentFilter = (value: string) => setAgentOverride(value);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const serverFilters = useMemo(
    () => ({
      agent_id: agentFilter === "all" ? undefined : agentFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      batch_id: batchId ?? undefined,
    }),
    [agentFilter, statusFilter, batchId]
  );
  const { data: executions, isLoading, error, refetch } = useExecutions(serverFilters);
  const { data: agents } = useAgents();

  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.agent_id, agent.agent_name));
    return map;
  }, [agents]);

  const hasActive = useMemo(
    () => (executions ?? []).some((execution) => !isTerminal(execution.status)),
    [executions]
  );

  // Live-tail running calls without hammering a settled list.
  useEffect(() => {
    if (!hasActive) return;
    const timer = setInterval(() => refetch(), 4000);
    return () => clearInterval(timer);
  }, [hasActive, refetch]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return executions ?? [];
    return (executions ?? []).filter(
      (execution: Execution) =>
        execution.to_number.toLowerCase().includes(query) ||
        execution.execution_id.toLowerCase().includes(query)
    );
  }, [executions, search]);

  const handleExport = () => {
    downloadCsv(`call-history-${new Date().toISOString().slice(0, 10)}.csv`, executionsToCsv(filtered));
  };

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      <PageHeader
        title="Call"
        accent="History"
        description="Every execution with transcripts, latency breakdowns and outcomes."
        className="mb-8"
        actions={
          <motion.button
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.15 }}
            onClick={handleExport}
            disabled={filtered.length === 0}
            className="h-11 px-5 rounded-2xl bg-card border border-border text-foreground font-medium text-sm transition-all hover:bg-accent disabled:opacity-40 flex items-center gap-2 self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </motion.button>
        }
      />

      {/* Filters */}
      {!batchId && <LatencyInsights agent_id={agentFilter === "all" ? undefined : agentFilter} />}
      {(batchId || agentFilter !== "all") && (
        <div className="mb-4 flex flex-wrap gap-2">
          {agentFilter !== "all" && (
            <button
              onClick={() => setAgentFilter("all")}
              title="Clear agent filter"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              agent: {(agents ?? []).find((a) => a.agent_id === agentFilter)?.agent_name ?? `${agentFilter.slice(0, 14)}…`} <X className="w-3.5 h-3.5" />
            </button>
          )}
          {batchId && (
            <Link
              href={agentFilter !== "all" ? `/calls?agent=${agentFilter}` : "/calls"}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              batch: {batchId.slice(0, 14)}… <X className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      )}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by number or execution id..."
            label="Search calls"
          />
        </div>
        <select
          value={agentFilter}
          onChange={(event) => setAgentFilter(event.target.value)}
          aria-label="Filter by agent"
          className={selectClass}
        >
          <option value="all">All agents</option>
          {(agents ?? []).map((agent) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.agent_name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
          className={selectClass}
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {isLoading ? (
        <SkeletonList rows={4} />
      ) : error ? (
        <ErrorState message="Failed to load call history. Is the backend running?" onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title="No calls yet"
          description={
            search || agentFilter !== "all" || statusFilter !== "all"
              ? "No executions match these filters. Try clearing them."
              : "Place a test call from the Studio to see executions appear here in real time."
          }
        >
          <Link
            href="/playground"
            className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
          >
            Open Studio
          </Link>
        </EmptyState>
      ) : (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-3">
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="col-span-3">Recipient</div>
            <div className="col-span-3">Agent</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Duration · E2E</div>
            <div className="col-span-2 text-right">Placed</div>
          </div>
          <AnimatePresence initial={false}>
            {filtered.map((execution) => (
              <motion.button
                key={execution.execution_id}
                layout="position"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedId(execution.execution_id)}
                className={cn(
                  "grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4 md:items-center p-4 md:px-6 md:py-4",
                  "bg-card border border-border rounded-3xl text-left transition-colors hover:bg-muted/60 group"
                )}
              >
                <div className="col-span-1 md:col-span-3 font-mono text-sm text-foreground">
                  {execution.to_number}
                </div>
                <div className="col-span-1 md:col-span-3 text-sm text-muted-foreground truncate">
                  {agentNames.get(execution.agent_id) ?? `${execution.agent_id.slice(0, 8)}…`}
                </div>
                <div className="col-span-1 md:col-span-2">
                  <StatusBadge status={execution.status} />
                </div>
                <div className="col-span-1 md:col-span-2 text-xs font-mono text-muted-foreground">
                  {formatDuration(execution.duration_s)} · {formatLatency(execution.latency?.e2e_ms)}
                </div>
                <div className="col-span-2 md:col-span-2 flex items-center justify-between md:justify-end gap-2 text-xs text-muted-foreground">
                  {timeAgo(execution.started_at)}
                  <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                </div>
              </motion.button>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <ExecutionDrawer executionId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
