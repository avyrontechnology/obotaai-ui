"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Download, PhoneCall, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CallsKpiStrip } from "@/components/calls/calls-kpi-strip";
import { CallsTable } from "@/components/calls/calls-table";
import { CallsToolbar } from "@/components/calls/calls-toolbar";
import { ExecutionDrawer } from "@/components/calls/execution-drawer";
import { LatencyInsights } from "@/components/calls/latency-insights";
import { isTerminal } from "@/components/calls/status-badge";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { SkeletonList } from "@/components/common/skeleton-list";
import { downloadCsv, executionsToCsv } from "@/lib/calls-export";
import { useAgents } from "@/services/api";
import { useExecutionStats, useExecutions, useLatencyStats } from "@/services/platform/executions";
import type { Execution } from "@/lib/schemas/platform";

const PAGE_SIZE = 25;

export default function CallsPage() {
  return (
    <Suspense>
      <CallsContent />
    </Suspense>
  );
}

function CallsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const batchId = searchParams.get("batch_id");
  const deepLinkedAgent = searchParams.get("agent");

  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  const agentFilter = agentOverride ?? deepLinkedAgent ?? "all";
  const setAgentFilter = useCallback(
    (value: string) => {
      setAgentOverride(value);
      const next = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "") next.delete("agent");
      else next.set("agent", value);
      next.delete("page");
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const [statusOverride, setStatusOverride] = useState<string | null>(null);
  const statusParam = searchParams.get("status") ?? "all";
  const statusFilter = statusOverride ?? statusParam;
  const setStatusFilter = useCallback(
    (value: string) => {
      setStatusOverride(value);
      const next = new URLSearchParams(searchParams.toString());
      if (value === "all" || value === "") next.delete("status");
      else next.set("status", value);
      next.delete("page");
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const initialQ = searchParams.get("q") ?? "";
  const [search, setSearchRaw] = useState(initialQ);
  const setSearch = useCallback(
    (value: string) => {
      setSearchRaw(value);
      const next = new URLSearchParams(searchParams.toString());
      if (value.trim() === "") next.delete("q");
      else next.set("q", value.trim());
      next.delete("page");
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );
  const selectedId = searchParams.get("execution_id");
  const setSelectedId = useCallback(
    (id: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (id) next.set("execution_id", id);
      else next.delete("execution_id");
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const pageParam = parseInt(searchParams.get("page") ?? "0", 10);
  const urlPage = Number.isFinite(pageParam) && pageParam >= 0 ? pageParam : 0;

  const [pageState, setPageState] = useState<{ basis: string; page: number }>({ basis: "", page: 0 });
  const pageBasis = `${agentFilter}|${statusFilter}|${batchId ?? ""}|${search.trim()}`;
  const localPage = pageState.basis === pageBasis ? pageState.page : 0;
  const page = searchParams.has("page") && urlPage !== localPage ? urlPage : localPage;

  const setPage = useCallback(
    (nextPage: number) => {
      setPageState({ basis: pageBasis, page: nextPage });
      const next = new URLSearchParams(searchParams.toString());
      if (nextPage === 0) next.delete("page");
      else next.set("page", String(nextPage));
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pageBasis, searchParams, router, pathname]
  );

  const serverFilters = useMemo(
    () => ({
      agent_id: agentFilter === "all" ? undefined : agentFilter,
      status: statusFilter === "all" ? undefined : statusFilter,
      batch_id: batchId ?? undefined,
      // +1 probe: distinguishes a full last page from "more available"
      // without a server total. Display slice is PAGE_SIZE.
      limit: PAGE_SIZE + 1,
      offset: page * PAGE_SIZE,
    }),
    [agentFilter, statusFilter, batchId, page]
  );

  const { data: executions, isLoading, isFetching, error, refetch } = useExecutions(serverFilters);
  const { data: agents } = useAgents();
  const agentScope = agentFilter === "all" ? undefined : agentFilter;
  const { data: stats, refetch: refetchStats } = useExecutionStats(agentScope);
  const { data: latency, isLoading: latencyLoading } = useLatencyStats(agentScope);
  // Probe row (index PAGE_SIZE) proves another page; never rendered.
  const hasMore = (executions?.length ?? 0) > PAGE_SIZE;
  const pageRows = useMemo(() => (executions ?? []).slice(0, PAGE_SIZE), [executions]);

  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.agent_id, agent.agent_name));
    return map;
  }, [agents]);

  const agentOptions = useMemo(
    () => (agents ?? []).map((a) => ({ agent_id: a.agent_id, agent_name: a.agent_name })),
    [agents]
  );

  const hasActive = useMemo(() => {
    if (stats && (stats.by_status["queued"] ?? 0) + (stats.by_status["ringing"] ?? 0) + (stats.by_status["in_progress"] ?? 0) > 0) return true;
    return (executions ?? []).some((execution) => !isTerminal(execution.status));
  }, [executions, stats]);

  useEffect(() => {
    if (!hasActive || typeof document === "undefined") return;
    if (document.visibilityState === "hidden") return;
    // Rows + stats share one clock so the KPI caption never freezes
    // while the table live-tails.
    const timer = setInterval(() => {
      refetch();
      refetchStats();
    }, 4000);
    const onVis = () => {
      if (document.visibilityState === "visible" && hasActive) {
        refetch();
        refetchStats();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [hasActive, refetch, refetchStats, serverFilters]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pageRows;
    return pageRows.filter(
      (execution: Execution) =>
        (execution.to_number ?? "").toLowerCase().includes(query) ||
        (execution.execution_id ?? "").toLowerCase().includes(query) ||
        (agentNames.get(execution.agent_id) ?? "").toLowerCase().includes(query) ||
        execution.status.toLowerCase().includes(query)
    );
  }, [pageRows, search, agentNames]);

  const from = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = page * PAGE_SIZE + filtered.length;
  const isFilteredSearch = search.trim().length > 0 && filtered.length !== pageRows.length;

  const handleExport = () => {
    if (filtered.length === 0) return;
    const pageLabel = page + 1;
    downloadCsv(`call-history-page${pageLabel}-${new Date().toISOString().slice(0, 10)}.csv`, executionsToCsv(filtered));
    if (hasMore || page > 0 || isFilteredSearch) {
      toast.info(`Exported ${filtered.length} calls from this page. Clear filters to include more.`);
    } else {
      toast.success(`Exported ${filtered.length} calls.`);
    }
  };

  const clearFilters = () => {
    setAgentOverride("all");
    setStatusOverride("all");
    setSearchRaw("");
    setPageState({ basis: "", page: 0 });
    // Preserve arrival context (batch) and open inspection (drawer) —
    // clearing search filters must not strand or close them.
    const next = new URLSearchParams(searchParams.toString());
    next.delete("agent");
    next.delete("status");
    next.delete("q");
    next.delete("page");
    const qs = next.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  };

  const hasAnyFilter = agentFilter !== "all" || statusFilter !== "all" || search.trim().length > 0 || !!batchId;

  const batchClearHref = (() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("batch_id");
    // keep agent/status/q/page as-is
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="flex flex-col flex-1 min-h-full max-w-7xl mx-auto w-full pt-8 pb-6 px-4 md:px-8 gap-0">
      {/* Hero — tightened to match dashboard */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-5 shrink-0">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-medium tracking-tighter text-foreground">
            Call <span className="text-muted-foreground">History</span>
          </h1>
          <p className="text-sm font-mono text-muted-foreground max-w-lg leading-relaxed">
            Every execution with transcripts, latency breakdowns and outcomes.
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          title={filtered.length === 0 ? "No rows to export" : hasMore || page > 0 ? "Exports the 25 rows on this page" : "Exports the rows on this page"}
          className="h-11 px-5 rounded-2xl bg-card border border-border text-foreground font-medium text-sm transition-all hover:bg-accent disabled:opacity-40 flex items-center gap-2 self-start md:self-auto shrink-0"
        >
          <Download className="w-4 h-4" aria-hidden="true" />
          <span>{hasMore || page > 0 ? "Export page (25)" : "Export CSV"}</span>
        </button>
      </div>

      <CallsKpiStrip
        executions={pageRows}
        agentId={agentFilter === "all" ? undefined : agentFilter}
        stats={stats}
        latency={latency}
        latencyLoading={latencyLoading}
        scopeNote={batchId ? "global total — table shows batch slice" : undefined}
      />

      <div className="mb-5">
        <LatencyInsights agent_id={agentFilter === "all" ? undefined : agentFilter} stats={latency} isLoading={latencyLoading} />
      </div>

      {/* Active filter pills */}
      {(batchId || agentFilter !== "all" || statusFilter !== "all" || search.trim()) && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {agentFilter !== "all" && (
            <button
              onClick={() => setAgentFilter("all")}
              title="Clear agent filter"
              aria-label="Remove agent filter"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              agent: {(agents ?? []).find((a) => a.agent_id === agentFilter)?.agent_name ?? `${agentFilter.slice(0, 14)}…`} <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {statusFilter !== "all" && (
            <button
              onClick={() => setStatusFilter("all")}
              title="Clear status filter"
              aria-label="Remove status filter"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              status: {statusFilter} <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          {batchId && (
            <Link
              href={batchClearHref}
              title={batchId}
              aria-label={`Remove batch filter ${batchId}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              batch: {batchId.slice(0, 14)}… <X className="w-3.5 h-3.5" aria-hidden="true" />
            </Link>
          )}
          {search.trim() && (
            <button
              onClick={() => setSearch("")}
              title="Clear search"
              aria-label="Remove search filter"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-muted text-muted-foreground border border-border hover:bg-muted/80 transition-colors"
            >
              search: {search.trim().slice(0, 20)} <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
          <button
            onClick={clearFilters}
            aria-label={batchId ? "Clear all filters except batch context" : "Clear all filters"}
            className="text-xs font-mono text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
          >
            {batchId ? "Clear filters (keep batch)" : "Clear all"}
          </button>
        </div>
      )}

      <CallsToolbar
        search={search}
        onSearch={setSearch}
        agentFilter={agentFilter}
        onAgentFilter={setAgentFilter}
        statusFilter={statusFilter}
        onStatusFilter={setStatusFilter}
        agents={agentOptions}
        isFetching={isFetching && !isLoading}
      />
      {isFilteredSearch && (
        <p className="text-xs font-mono text-muted-foreground mb-3">Showing page filter · {filtered.length} of {pageRows.length} on this page — use agent/status filters for full history.</p>
      )}

      {/* List */}
      {isLoading ? (
        <SkeletonList rows={8} rowClassName="h-[68px]" />
      ) : error ? (
        <ErrorState message="Failed to load call history. Is the backend running?" onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={PhoneCall}
          title={hasAnyFilter ? "No matching calls" : "No calls yet"}
          description={
            hasAnyFilter
              ? "No executions match these filters. Try clearing them or adjusting your search."
              : "Talk to an agent in the Playground to see executions appear here in real time."
          }
        >
          {hasAnyFilter ? (
            <button
              onClick={clearFilters}
              className="px-6 py-3 rounded-2xl bg-card border border-border text-sm font-semibold transition-all hover:bg-accent"
            >
              Clear filters
            </button>
          ) : (
            <Link
              href="/playground"
              className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:shadow-xl inline-flex items-center justify-center"
            >
              Open Playground
            </Link>
          )}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-0 min-h-0">
          <div
            className="rounded-3xl border border-border bg-card md:overflow-hidden transition-opacity motion-reduce:transition-none"
            aria-busy={isFetching && !isLoading}
            style={isFetching && !isLoading ? { opacity: 0.6 } : undefined}
          >
            <CallsTable executions={filtered} agentNames={agentNames} onSelect={setSelectedId} />
          </div>

          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs font-mono text-muted-foreground tabular-nums">
              {from}–{to}{!batchId && stats ? ` of ${stats.total.toLocaleString()}` : ""} {hasMore ? "· more available" : "· end"} {isFetching && !isLoading ? "· updating…" : ""}
            </p>
            {(page > 0 || hasMore) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                  className="h-9 px-4 rounded-2xl bg-card border border-border text-sm font-medium transition-all hover:bg-accent disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-xs font-mono text-muted-foreground min-w-[64px] text-center">Page {page + 1}</span>
                <button
                  onClick={() => setPage(page + 1)}
                  disabled={!hasMore}
                  aria-label="Next page"
                  className="h-9 px-4 rounded-2xl bg-card border border-border text-sm font-medium transition-all hover:bg-accent disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ExecutionDrawer executionId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
