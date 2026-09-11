"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Cpu,
  Database,
  Loader2,
  MessageSquareText,
  Mic,
  PhoneCall,
  Settings2,
  Terminal,
  Trash2,
  Volume2,
  Wrench,
  X,
} from "lucide-react";
import { useAgent, useDeleteAgent } from "@/services/api";
import {
  useExecutions,
  useExecutionStats,
  useLatencyStats,
} from "@/services/platform/executions";
import { useAgentTools } from "@/services/platform/tools";
import { useKnowledgeBases } from "@/services/platform/knowledgebases";
import { useInbound } from "@/services/platform/inbound";
import { formatDuration, formatLatency, timeAgo } from "@/lib/format";
import { StatCard } from "@/components/common/stat-card";
import { StatusBadge } from "@/components/calls/status-badge";
import { notify } from "@/lib/notify";
import { minRoleFor, useCan } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const TYPE_META: Record<string, { label: string; icon: typeof Mic }> = {
  voice: { label: "Voice", icon: Mic },
  text: { label: "Text", icon: Terminal },
  s2s: { label: "Realtime", icon: Cpu },
};

export default function AgentOverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Core record — dedicated detail endpoint, NOT the list.
  const { data: agent, isLoading, error, refetch } = useAgent(id);
  // Scoped telemetry — filtered by agent_id, never the unfiltered list hook.
  const { data: stats } = useExecutionStats(id);
  const { data: latency } = useLatencyStats(id);
  const { data: recent } = useExecutions({ agent_id: id });
  // Platform attachments for this agent.
  const { data: tools } = useAgentTools(id);
  const { data: kbs } = useKnowledgeBases();
  const { data: inbound } = useInbound(id);
  const deleteMutation = useDeleteAgent();
  const canDelete = useCan("agents.delete");

  if (isLoading) {
    return (
      <div className="flex flex-col flex-1 min-h-[60vh] max-w-7xl mx-auto w-full pt-12 px-4 md:px-8 gap-4" aria-busy="true">
        <div className="h-10 w-64 rounded-2xl bg-card border border-border animate-pulse" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-card border border-border animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-[2rem] bg-card border border-border animate-pulse" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 max-w-7xl mx-auto w-full pt-12 px-4">
        <AlertCircle className="w-10 h-10 text-red-400" aria-hidden="true" />
        <p className="font-mono text-sm text-muted-foreground">Agent not found or backend unreachable.</p>
        <div className="flex gap-3">
          <button
            onClick={() => refetch()}
            className="px-6 py-2.5 rounded-xl bg-card border border-border text-sm font-semibold hover:bg-accent transition-colors"
          >
            Retry
          </button>
          <Link
            href="/agents"
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            Back to OboFleet
          </Link>
        </div>
      </div>
    );
  }

  const meta = TYPE_META[agent.agent_type] ?? { label: agent.agent_type, icon: Mic };
  const TypeIcon = meta.icon;
  const isS2S = agent.agent_type === "s2s";
  const attachedKbs = (kbs ?? []).filter((kb) => kb.agent_ids.includes(id));
  const sortedRecent = [...(recent ?? [])]
    .sort((a, b) => +new Date(b.started_at) - +new Date(a.started_at))
    .slice(0, 5);

  const isText = agent.agent_type === "text";
  const pipeline = isS2S
    ? [
        {
          label: "Realtime Engine",
          value: `${agent.agent_config.s2s?.provider ?? "openai_realtime"} · ${agent.agent_config.s2s?.model ?? "default"}`,
          icon: Cpu,
        },
      ]
    : isText
      ? [
          {
            label: "Think",
            value: `${agent.agent_config.llm?.provider ?? "openai"} · ${agent.agent_config.llm?.model ?? "gpt-4o"}`,
            icon: Cpu,
          },
        ]
      : [
          {
            label: "Listen",
            value: `${agent.agent_config.transcriber?.provider ?? "deepgram"} · ${agent.agent_config.transcriber?.model ?? "nova-2"}`,
            icon: Mic,
          },
          {
            label: "Think",
            value: `${agent.agent_config.llm?.provider ?? "openai"} · ${agent.agent_config.llm?.model ?? "gpt-4o"}`,
            icon: Cpu,
          },
          {
            label: "Speak",
            value: `${agent.agent_config.synthesizer?.provider ?? "elevenlabs"} · ${agent.agent_config.synthesizer?.voice ?? "Rachel"}`,
            icon: Volume2,
          },
        ];

  const handleDelete = () => {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        notify.success("Agent deleted", { description: agent.agent_name });
        router.push("/agents");
      },
    });
  };

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <Link
        href="/agents"
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200 mb-6 w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> OboFleet
      </Link>

      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6 md:mb-8">
        <div className="flex items-start gap-4 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <TypeIcon className="w-6 h-6 text-ember-700 dark:text-ember-300" strokeWidth={1.5} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3 flex-wrap min-w-0">
              <h1 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground truncate min-w-0 flex-1" title={agent.agent_name}>
                {agent.agent_name}
              </h1>
              <span className="px-3 py-1 rounded-full bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20 text-xs font-mono shrink-0">
                {meta.label}
              </span>
            </div>
            <p className="text-xs font-mono text-muted-foreground mt-2 break-all" title={`${agent.agent_id} · ${agent.agent_config.llm?.model ?? agent.agent_config.s2s?.model ?? "no model set"}`}>
              {agent.agent_id} · {agent.agent_config.llm?.model ?? agent.agent_config.s2s?.model ?? "no model set"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/playground?agent=${agent.agent_id}&mode=talk`}
            className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground font-medium text-sm shadow-lg shadow-primary/20 hover:bg-primary/90 transition-colors duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            <Mic className="w-4 h-4" aria-hidden="true" /> Talk
          </Link>
          <Link
            href={`/playground?agent=${agent.agent_id}&mode=chat`}
            className="h-11 px-5 rounded-2xl bg-card border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            <MessageSquareText className="w-4 h-4" aria-hidden="true" /> Chat
          </Link>
          <Link
            href={`/agents/${agent.agent_id}/configure`}
            className="h-11 px-5 rounded-2xl bg-card border border-border text-foreground font-medium text-sm hover:bg-accent transition-colors duration-200 flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            <Settings2 className="w-4 h-4" aria-hidden="true" /> Configure
          </Link>
          <Link
            href={`/calls?agent=${agent.agent_id}`}
            className="h-11 px-5 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground font-medium text-sm hover:bg-accent transition-colors duration-200 hidden sm:flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            Calls <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
          <Link
            href={`/batches?agent=${agent.agent_id}&new=1`}
            className="h-11 px-5 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground font-medium text-sm hover:bg-accent transition-colors duration-200 hidden sm:flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            Campaign <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>
      </div>

      {/* Telemetry */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <StatCard title="Total Calls" value={String(stats?.total ?? sortedRecent.length ?? 0)} />
        <StatCard
          title="Avg Latency"
          value={formatLatency(stats?.avg_e2e_ms ?? latency?.p50_e2e_ms ?? null)}
        />
        <StatCard
          title="Success Rate"
          value={stats ? `${Math.round(stats.completed_rate * 100)}%` : "—"}
        />
        <StatCard
          title="Attached Tools"
          value={String(tools?.length ?? 0)}
          className="hidden sm:block"
        />
      </div>

      {/* Pipeline */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="bg-card border border-border rounded-3xl p-5 md:p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Runtime Pipeline</h2>
          <Link
            href={`/agents/${agent.agent_id}/configure`}
            className="text-sm text-ember-700 dark:text-ember-300 hover:underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            Edit pipeline →
          </Link>
        </div>
        <div className={cn("grid gap-3", pipeline.length > 1 ? "grid-cols-1 lg:grid-cols-3" : "grid-cols-1")}>
          {pipeline.map((stage) => (
            <div
              key={stage.label}
              className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 p-4"
            >
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <stage.icon className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">{stage.label}</p>
                <p className="text-sm font-medium text-foreground truncate">{stage.value}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-xs text-muted-foreground">
            <Wrench className="w-3.5 h-3.5" aria-hidden="true" /> {tools?.length ?? 0} tools
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-xs text-muted-foreground">
            <Database className="w-3.5 h-3.5" aria-hidden="true" /> {attachedKbs.length} knowledge bases
          </span>
          {inbound && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted border border-border text-xs text-muted-foreground">
              <PhoneCall className="w-3.5 h-3.5" aria-hidden="true" /> Inbound {inbound.spam_protection ? "protected" : "open"}
            </span>
          )}
        </div>
      </motion.section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent calls */}
        <section className="bg-card border border-border rounded-3xl p-5 md:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Recent Calls</h2>
            <Link href={`/calls?agent=${agent.agent_id}`} className="text-sm text-ember-700 dark:text-ember-300 hover:underline underline-offset-4 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50">
              All calls →
            </Link>
          </div>
          {sortedRecent.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">
              No executions yet. Place a test call to see live telemetry here.
            </p>
          ) : (
            <ul className="space-y-2">
              {sortedRecent.map((execution) => (
                <li
                  key={execution.execution_id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono text-foreground truncate">{execution.to_number ?? "—"}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                      <StatusBadge status={execution.status} /> · {formatDuration(execution.duration_s)} · {timeAgo(execution.started_at)}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {formatLatency(execution.latency?.e2e_ms)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Danger zone */}
        <section className="bg-card border border-border rounded-3xl p-5 md:p-6 h-fit">
          <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1">Danger Zone</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Deleting permanently removes this agent and its configuration. This cannot be undone.
            {!canDelete && ` Requires ${minRoleFor("agents.delete")} role.`}
          </p>
          {!canDelete ? (
            <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-4">
              Read-only for your role.
            </p>
          ) : !confirmingDelete ? (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-2 px-5 h-11 rounded-2xl bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 text-sm font-semibold hover:bg-red-500/20 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
            >
              <Trash2 className="w-4 h-4" aria-hidden="true" /> Delete agent
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={handleDelete}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-2 px-5 h-11 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
              >
                {deleteMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Check className="w-4 h-4" aria-hidden="true" />}
                Confirm delete
              </button>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="h-11 w-11 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
                aria-label="Cancel delete"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
