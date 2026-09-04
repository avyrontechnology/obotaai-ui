"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  LayoutTemplate,
  Mic,
  Terminal,
  Cpu,
  Settings2,
  Bot,
  PhoneCall,
  Trash2,
  Check,
  X,
  ArrowUpDown,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { SearchInput } from "@/components/common/search-input";
import { EmptyState } from "@/components/common/empty-state";
import { SkeletonList } from "@/components/common/skeleton-list";
import Link from "next/link";
import { formatLatency } from "@/lib/format";
import { ErrorState } from "@/components/common/error-state";
import { useAgents, useDeleteAgent, type Agent } from "@/services/api";
import { useExecutions } from "@/services/platform/executions";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: typeof Mic; color: string; bg: string }> = {
  voice: { label: "Voice", icon: Mic, color: "text-ember-600 dark:text-ember-400", bg: "bg-ember-500/10" },
  text: { label: "Text", icon: Terminal, color: "text-ember-700 dark:text-ember-300", bg: "bg-ember-300/20" },
  s2s: { label: "Realtime", icon: Cpu, color: "text-ember-700 dark:text-ember-300", bg: "bg-primary/10" },
};

type TypeFilter = "all" | "voice" | "text" | "s2s";
type SortKey = "name" | "latency" | "volume";

function metaFor(agent: Agent) {
  return TYPE_META[agent.agent_type] ?? {
    label: agent.agent_type,
    icon: Mic,
    color: "text-muted-foreground",
    bg: "bg-muted",
  };
}

function AgentRow({
  agent,
  calls,
  avgLatency,
  index,
}: {
  agent: Agent;
  calls: number;
  avgLatency: number | null;
  index: number;
}) {
  const meta = metaFor(agent);
  const Icon = meta.icon;
  const deleteMutation = useDeleteAgent();
  const [confirming, setConfirming] = useState(false);
  const model = agent.agent_config.llm?.model ?? agent.agent_config.s2s?.model ?? "—";

  return (
    <motion.div
      key={agent.agent_id}
      layout="position"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: Math.min(0.15 + index * 0.04, 0.5) }}
      className="grid grid-cols-1 md:grid-cols-12 gap-4 md:items-center p-4 md:px-6 md:py-5 bg-card backdrop-blur-md border border-border rounded-3xl transition-colors hover:bg-muted/60 group relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-[100%] group-hover:translate-x-[100%] transition-transform duration-1000 ease-in-out pointer-events-none" />

      {/* Identity → overview */}
      <Link href={`/agents/${agent.agent_id}`} className="col-span-4 flex items-center gap-4 min-w-0">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center border border-border shadow-inner shrink-0", meta.bg)}>
          <Icon className={cn("w-5 h-5", meta.color)} strokeWidth={1.5} />
        </div>
        <div className="min-w-0">
          <h3 className="font-medium text-foreground tracking-tight truncate group-hover:text-ember-700 dark:group-hover:text-ember-300 transition-colors">
            {agent.agent_name}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {agent.agent_id.slice(0, 8)}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted" />
            <span className="text-xs text-muted-foreground">{meta.label}</span>
          </div>
        </div>
      </Link>

      <div className="col-span-3 hidden md:flex items-center">
        <div className="px-3 py-1.5 rounded-full bg-muted border border-border text-xs font-mono text-muted-foreground truncate max-w-full">
          {model}
        </div>
      </div>

      <div className="col-span-2 hidden md:flex flex-col gap-1">
        <div className="flex items-center justify-between max-w-[120px]">
          <span className="text-xs text-muted-foreground">Latency</span>
          <span className="text-xs font-mono text-foreground">
            {avgLatency !== null ? formatLatency(avgLatency) : "—"}
          </span>
        </div>
        <div className="flex items-center justify-between max-w-[120px]">
          <span className="text-xs text-muted-foreground">Vol</span>
          <span className="text-xs font-mono text-foreground">{calls}</span>
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-between md:justify-start">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-xs font-medium text-foreground">Active</span>
        </div>
      </div>

      <div className="col-span-1 flex items-center justify-end gap-1" onClick={(e) => e.preventDefault()}>
        <Link
          href={`/playground?agent=${agent.agent_id}`}
          aria-label={`Test ${agent.agent_name}`}
          title="Test in Playground"
          className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <PhoneCall className="w-4 h-4" />
        </Link>
        <Link
          href={`/agents/${agent.agent_id}/configure`}
          aria-label={`Configure ${agent.agent_name}`}
          title="Configure"
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
        >
          <Settings2 className="w-4 h-4" />
        </Link>
        {confirming ? (
          <span className="flex items-center gap-1">
            <button
              onClick={() => {
                deleteMutation.mutate(agent.agent_id, {
                  onSuccess: () => notify.success("Agent deleted", { description: agent.agent_name }),
                });
                setConfirming(false);
              }}
              disabled={deleteMutation.isPending}
              aria-label="Confirm delete"
              className="w-8 h-8 rounded-full flex items-center justify-center bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              onClick={() => setConfirming(false)}
              aria-label="Cancel delete"
              className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${agent.agent_name}`}
            title="Delete"
            className="w-8 h-8 rounded-full hidden sm:flex items-center justify-center hover:bg-red-500/10 text-muted-foreground hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </motion.div>
  );
}

export default function AgentsPage() {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");

  const { data: agents, isLoading, error, refetch } = useAgents();
  // Aggregate model: ONE unfiltered fetch for list telemetry.
  // Detail pages use useExecutions({ agent_id }) + useExecutionStats instead.
  const { data: executions } = useExecutions();

  const telemetry = useMemo(() => {
    const map = new Map<string, { calls: number; latencies: number[] }>();
    (executions ?? []).forEach((execution) => {
      const entry = map.get(execution.agent_id) ?? { calls: 0, latencies: [] };
      entry.calls += 1;
      if (execution.latency) entry.latencies.push(execution.latency.e2e_ms);
      map.set(execution.agent_id, entry);
    });
    return map;
  }, [executions]);

  const avgFor = (agentId: string): number | null => {
    const stats = telemetry.get(agentId);
    if (!stats || stats.latencies.length === 0) return null;
    return Math.round(stats.latencies.reduce((a, b) => a + b, 0) / stats.latencies.length);
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    let rows = agents ?? [];
    if (typeFilter !== "all") rows = rows.filter((a) => a.agent_type === typeFilter);
    if (needle) {
      rows = rows.filter(
        (agent) =>
          agent.agent_name.toLowerCase().includes(needle) || agent.agent_id.toLowerCase().includes(needle)
      );
    }
    const sorted = [...rows];
    if (sortKey === "name") sorted.sort((a, b) => a.agent_name.localeCompare(b.agent_name));
    if (sortKey === "volume") {
      sorted.sort((a, b) => (telemetry.get(b.agent_id)?.calls ?? 0) - (telemetry.get(a.agent_id)?.calls ?? 0));
    }
    if (sortKey === "latency") {
      sorted.sort((a, b) => (avgFor(a.agent_id) ?? Number.MAX_SAFE_INTEGER) - (avgFor(b.agent_id) ?? Number.MAX_SAFE_INTEGER));
    }
    return sorted;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agents, query, typeFilter, sortKey, telemetry]);

  const cycleSort = () => {
    setSortKey((prev) => (prev === "name" ? "volume" : prev === "volume" ? "latency" : "name"));
  };

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      <PageHeader
        title="Agent"
        accent="Directory"
        description="Every agent with live call telemetry. Open an overview, configure the pipeline, or deploy from scratch."
        actions={
          <>
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Search registry..."
              label="Search agents"
            />

            <Link href="/library">
              <motion.span
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="h-11 px-5 rounded-2xl bg-card border border-border text-foreground font-medium text-sm transition-all hover:bg-accent flex items-center gap-2"
              >
                <LayoutTemplate className="w-4 h-4" />
                <span>Templates</span>
              </motion.span>
            </Link>

            <Link href="/agents/new">
              <motion.span
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                className="h-11 px-6 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-[0_8px_20px_-8px_rgba(0,0,0,0.3)] hover:shadow-[0_12px_24px_-8px_rgba(0,0,0,0.4)] transition-all flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Deploy Agent</span>
              </motion.span>
            </Link>
          </>
        }
      />

      {/* Filter + sort bar */}
      {!isLoading && !error && (agents ?? []).length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          {(["all", "voice", "text", "s2s"] as TypeFilter[]).map((option) => (
            <button
              key={option}
              onClick={() => setTypeFilter(option)}
              aria-pressed={typeFilter === option}
              className={cn(
                "px-4 h-9 rounded-full text-xs font-mono border transition-colors capitalize",
                typeFilter === option
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {option === "s2s" ? "Realtime" : option}
            </button>
          ))}
          <button
            onClick={cycleSort}
            title="Cycle sort: name → volume → latency"
            className="ml-auto flex items-center gap-2 px-4 h-9 rounded-full text-xs font-mono border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            Sort: {sortKey}
          </button>
        </div>
      )}

      {isLoading ? (
        <SkeletonList rows={5} />
      ) : error ? (
        <ErrorState message="Failed to load agents. Is the backend running?" onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bot}
          title={query || typeFilter !== "all" ? "No matches" : "Registry is empty"}
          description={
            query || typeFilter !== "all"
              ? "Try a different search or filter."
              : "Import a production-ready template or deploy your first agent."
          }
        >
          {!query && typeFilter === "all" && (
            <div className="flex gap-3">
              <Link
                href="/library"
                className="px-6 py-3 rounded-2xl bg-card border border-border text-sm font-semibold hover:bg-accent transition-colors"
              >
                Browse Templates
              </Link>
              <Link
                href="/agents/new"
                className="px-6 py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg transition-all hover:shadow-xl"
              >
                Deploy Agent
              </Link>
            </div>
          )}
        </EmptyState>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6, type: "spring", bounce: 0.3 }}
          className="flex flex-col gap-4"
        >
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            <div className="col-span-4">Agent</div>
            <div className="col-span-3">Core Model</div>
            <div className="col-span-2">Telemetry</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          <AnimatePresence initial={false}>
            {filtered.map((agent, index) => {
              const stats = telemetry.get(agent.agent_id);
              return (
                <AgentRow
                  key={agent.agent_id}
                  agent={agent}
                  calls={stats?.calls ?? 0}
                  avgLatency={avgFor(agent.agent_id)}
                  index={index}
                />
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
