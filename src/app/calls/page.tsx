"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { Download, PhoneCall, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CallsKpiStrip } from "@/components/calls/calls-kpi-strip";
import { CallsTable } from "@/components/calls/calls-table";
import { CallsToolbar } from "@/components/calls/calls-toolbar";
import { ExecutionDrawer } from "@/components/calls/execution-drawer";
import { LatencyInsights } from "@/components/calls/latency-insights";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ErrorState } from "@/components/common/error-state";
import { SkeletonList } from "@/components/common/skeleton-list";
import { downloadCsv, executionsToCsv } from "@/lib/calls-export";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { useAgents } from "@/services/api";
import { useExecutionStats, useExecutions, useLatencyStats } from "@/services/platform/executions";
import type { Execution } from "@/lib/schemas/platform";

const PAGE_SIZE = 25;
const LIVE_REFETCH_MS = 5000;
const DAY_OPTIONS = [7, 30, 90];

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

  // Local-only page narrowing: the executions API has no direction
  // parameter, so this filters the loaded rows exactly like search.
  // No URL contract — direction never leaves the client.
  const [directionFilter, setDirectionOverride] = useState("all");
  const setDirectionFilter = useCallback(
    (value: string) => {
      setDirectionOverride(value);
      const next = new URLSearchParams(searchParams.toString());
      next.delete("page");
      const qs = next.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  // Latency summary window (days: 7/30/90) and the Live Ingest poll switch.
  // Both are local UI state with no URL contract.
  const [days, setDays] = useState(30);
  const [liveIngest, setLiveIngest] = useState(false);

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

  const [pageState, setPageState] = useState<{ basis: string; page: number; visited: number[] }>({
    basis: "",
    page: 0,
    visited: [0],
  });
  const pageBasis = `${agentFilter}|${statusFilter}|${batchId ?? ""}|${search.trim()}|${directionFilter}`;
  const basisMatch = pageState.basis === pageBasis;
  const localPage = basisMatch ? pageState.page : 0;
  const page = searchParams.has("page") && urlPage !== localPage ? urlPage : localPage;
  // Numbered pager shows visited pages only — the server never reports a
  // total, so page buttons are limited to what this session has loaded.
  const visitedPages = useMemo(
    () =>
      Array.from(new Set([...(basisMatch ? pageState.visited : [0]), page])).sort((a, b) => a - b),
    [basisMatch, pageState.visited, page]
  );

  const setPage = useCallback(
    (nextPage: number) => {
      setPageState((prev) => {
        const prior = prev.basis === pageBasis ? prev.visited : [0];
        return {
          basis: pageBasis,
          page: nextPage,
          visited: Array.from(new Set([...prior, nextPage])).sort((a, b) => a - b),
        };
      });
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

  // Live Ingest drives every poll clock: on = 5s refetch across rows,
  // stats and latency so captions never freeze; off = no polling.
  const liveOption: { refetchInterval: number | false } = {
    refetchInterval: liveIngest ? LIVE_REFETCH_MS : false,
  };
  const { data: executions, isLoading, isFetching, error, refetch } = useExecutions(serverFilters, liveOption);
  const { data: agents } = useAgents();
  const agentScope = agentFilter === "all" ? undefined : agentFilter;
  const { data: stats, refetch: refetchStats } = useExecutionStats(agentScope, liveOption);
  const { data: latency, isLoading: latencyLoading, refetch: refetchLatency } = useLatencyStats(agentScope, days, liveOption);
  // Probe row (index PAGE_SIZE) proves another page; never rendered.
  const hasMore = (executions?.length ?? 0) > PAGE_SIZE;
  const pageRows = useMemo(() => (executions ?? []).slice(0, PAGE_SIZE), [executions]);

  const agentNames = useMemo(() => {
    const map = new Map<string, string>();
    (agents ?? []).forEach((agent) => map.set(agent.agent_id, agent.agent_name));
    return map;
  }, [agents]);

  const agentModels = useMemo(() => {
    const map = new Map<string, string>();
    // Defensive: list responses always carry agent_config, but partial
    // mocks/stale caches may not — unknown models render "—", never crash.
    (agents ?? []).forEach((agent) => {
      const model = agent.agent_config?.llm?.model ?? agent.agent_config?.s2s?.model;
      if (model) map.set(agent.agent_id, model);
    });
    return map;
  }, [agents]);

  const agentOptions = useMemo(
    () => (agents ?? []).map((a) => ({ agent_id: a.agent_id, agent_name: a.agent_name })),
    [agents]
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pageRows.filter((execution: Execution) => {
      if (directionFilter !== "all" && execution.direction !== directionFilter) return false;
      if (!query) return true;
      return (
        (execution.to_number ?? "").toLowerCase().includes(query) ||
        (execution.from_number ?? "").toLowerCase().includes(query) ||
        (execution.execution_id ?? "").toLowerCase().includes(query) ||
        (agentNames.get(execution.agent_id) ?? "").toLowerCase().includes(query) ||
        execution.status.toLowerCase().includes(query)
      );
    });
  }, [pageRows, search, agentNames, directionFilter]);

  const from = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = page * PAGE_SIZE + filtered.length;
  const isPageNarrowed =
    (search.trim().length > 0 || directionFilter !== "all") && filtered.length !== pageRows.length;
  // Honest footer math: cumulative loaded rows are exact because pager
  // navigation is contiguous from page 0 (visited pages only).
  const loadedTotal = page * PAGE_SIZE + pageRows.length;

  const handleRefresh = useCallback(() => {
    refetch();
    refetchStats();
    refetchLatency();
  }, [refetch, refetchStats, refetchLatency]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    const pageLabel = page + 1;
    downloadCsv(`call-history-page${pageLabel}-${new Date().toISOString().slice(0, 10)}.csv`, executionsToCsv(filtered));
    if (hasMore || page > 0 || isPageNarrowed) {
      toast.info(`Exported ${filtered.length} calls from this page. Clear filters to include more.`);
    } else {
      toast.success(`Exported ${filtered.length} calls.`);
    }
  };

  const clearFilters = () => {
    setAgentOverride("all");
    setStatusOverride("all");
    setSearchRaw("");
    setDirectionOverride("all");
    setPageState({ basis: "", page: 0, visited: [0] });
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

  const hasAnyFilter =
    agentFilter !== "all" ||
    statusFilter !== "all" ||
    search.trim().length > 0 ||
    directionFilter !== "all" ||
    !!batchId;

  const batchClearHref = (() => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("batch_id");
    // keep agent/status/q/page as-is
    const qs = next.toString();
    return `${pathname}${qs ? `?${qs}` : ""}`;
  })();

  return (
    <div className="flex flex-col flex-1 min-h-full max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8 gap-0">
      <PageHeader
        title={
          <>
            <span>Call History</span>
            <span className="font-mono text-xs font-normal tracking-normal px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground shrink-0">
              v2.4 Telemetry
            </span>
          </>
        }
        description="Every voice execution with raw transcripts, latency breakdowns and stage timings."
        actions={
          <>
            <select
              value={String(days)}
              onChange={(event) => setDays(Number(event.target.value))}
              aria-label="Latency window"
              title="Latency summary window"
              className={cn(fieldStyles.field, "w-auto min-w-0 shrink-0 tabular-nums")}
            >
              {DAY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  Last {option} days
                </option>
              ))}
            </select>
            <button
              onClick={handleExport}
              disabled={filtered.length === 0}
              title={
                filtered.length === 0
                  ? "No rows to export"
                  : `Exports the ${filtered.length} rows loaded on this page`
              }
              className="h-11 px-5 rounded-2xl bg-card border border-border text-foreground font-medium text-sm transition-all hover:bg-accent disabled:opacity-40 flex items-center gap-2 shrink-0"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              <span>Export page ({filtered.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setLiveIngest((value) => !value)}
              aria-pressed={liveIngest}
              aria-label="Toggle live ingest"
              title={
                liveIngest
                  ? "Live ingest on — refreshing every 5 seconds"
                  : "Live ingest off — turn on to refresh every 5 seconds"
              }
              className={cn(
                "h-11 px-4 rounded-2xl border text-sm font-medium flex items-center gap-2 transition-colors shrink-0",
                liveIngest
                  ? "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20"
                  : "bg-card border-border text-foreground hover:bg-accent"
              )}
            >
              <span
                className={cn(
                  "w-2 h-2 rounded-full shrink-0",
                  liveIngest ? "bg-red-500 animate-pulse motion-reduce:animate-none" : "bg-muted-foreground/40"
                )}
                aria-hidden="true"
              />
              Live Ingest
            </button>
          </>
        }
      />

      <CallsKpiStrip
        executions={pageRows}
        agentId={agentFilter === "all" ? undefined : agentFilter}
        stats={stats}
        latency={latency}
        latencyLoading={latencyLoading}
        scopeNote={batchId ? "global total — table shows batch slice" : undefined}
      />

      <div className="mb-6">
        <LatencyInsights
          agent_id={agentFilter === "all" ? undefined : agentFilter}
          days={days}
          stats={latency}
          isLoading={latencyLoading}
        />
      </div>

      {/* Active filter pills */}
      {(batchId || agentFilter !== "all" || statusFilter !== "all" || directionFilter !== "all" || search.trim()) && (
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
          {directionFilter !== "all" && (
            <button
              onClick={() => setDirectionFilter("all")}
              title="Page filter — narrows the loaded rows. The executions API has no direction parameter."
              aria-label="Remove direction filter"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
            >
              direction: {directionFilter} <X className="w-3.5 h-3.5" aria-hidden="true" />
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
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 hover:bg-primary/20 transition-colors"
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
        directionFilter={directionFilter}
        onDirectionFilter={setDirectionFilter}
        onRefresh={handleRefresh}
        agents={agentOptions}
        isFetching={isFetching && !isLoading}
      />
      {isPageNarrowed && (
        <p className="text-xs font-mono text-muted-foreground mt-1 mb-3">Showing page filter · {filtered.length} of {pageRows.length} on this page — use agent/status filters for full history.</p>
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
            <CallsTable executions={filtered} agentNames={agentNames} agentModels={agentModels} onSelect={setSelectedId} />
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-between gap-3 pb-1">
            <p className="text-xs font-mono text-muted-foreground tabular-nums">
              {isPageNarrowed
                ? `Showing ${filtered.length} of ${pageRows.length} loaded executions · Page size: ${PAGE_SIZE} rows`
                : `Showing ${from}–${to} of ${loadedTotal} loaded executions · Page size: ${PAGE_SIZE} rows`}
              {isFetching && !isLoading ? " · updating…" : ""}
            </p>
            {(page > 0 || hasMore) && (
              <nav aria-label="Call history pages" className="flex flex-wrap items-center justify-center gap-2">
                <button
                  onClick={() => setPage(page - 1)}
                  disabled={page === 0}
                  aria-label="Previous page"
                  className="h-9 px-4 rounded-2xl bg-card border border-border text-sm font-medium transition-all hover:bg-accent disabled:opacity-40"
                >
                  Previous
                </button>
                {visitedPages.map((visited) => (
                  <button
                    key={visited}
                    onClick={() => setPage(visited)}
                    aria-label={`Go to page ${visited + 1}`}
                    aria-current={visited === page ? "page" : undefined}
                    className={cn(
                      "h-9 min-w-9 px-2 rounded-xl border text-sm font-mono tabular-nums transition-colors",
                      visited === page
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-card border-border hover:bg-accent"
                    )}
                  >
                    {visited + 1}
                  </button>
                ))}
                <span className="text-xs font-mono text-muted-foreground min-w-[64px] text-center">Page {page + 1}</span>
                {hasMore && (
                  <>
                    <span aria-hidden="true" className="text-muted-foreground">
                      …
                    </span>
                    <button
                      onClick={() => setPage(page + 1)}
                      aria-label="Next page"
                      className="h-9 px-4 rounded-2xl bg-card border border-border text-sm font-medium transition-all hover:bg-accent disabled:opacity-40"
                    >
                      Next
                    </button>
                  </>
                )}
              </nav>
            )}
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-xs font-mono text-muted-foreground">
        OtobaAI Voice Engine v2.4 · Running low-latency speech pipelines on dedicated inference clusters.
      </p>

      <ExecutionDrawer executionId={selectedId} onClose={() => setSelectedId(null)} />
    </div>
  );
}
