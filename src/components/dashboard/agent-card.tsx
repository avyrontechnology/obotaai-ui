"use client";

import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  Terminal,
  Cpu,
  Trash2,
  Settings2,
  PhoneCall,
  ArrowUpRight,
  X,
  Check,
} from "lucide-react";
import { Agent, useDeleteAgent } from "@/services/api";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { useCan } from "@/lib/rbac";
import { formatLatency, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface FleetStats {
  sessions: number;
  avgLatencyMs: number | null;
  successRate: number | null;
  lastCallAt: string | null;
}

interface AgentCardProps {
  agent: Agent;
  sessions?: number;
  stats?: FleetStats | null;
}

const TYPE_META: Record<string, { label: string; icon: typeof Mic }> = {
  voice: { label: "Voice", icon: Mic },
  text: { label: "Text", icon: Terminal },
  s2s: { label: "Realtime", icon: Cpu },
};

export const AgentCard = memo(function AgentCard({ agent, sessions, stats }: AgentCardProps) {
  const deleteMutation = useDeleteAgent();
  const canDelete = useCan("agents.delete");
  const [showConfirm, setShowConfirm] = useState(false);
  const isDeleting = deleteMutation.isPending;

  const meta = TYPE_META[agent.agent_type] ?? { label: agent.agent_type, icon: Mic };
  const Icon = meta.icon;
  const model = agent.agent_config.llm?.model ?? agent.agent_config.s2s?.model ?? "—";
  const calls = stats?.sessions ?? sessions ?? 0;
  const avgLatency = stats?.avgLatencyMs ?? null;
  const successRate = stats?.successRate ?? null;
  const lastCall = stats?.lastCallAt ?? null;

  const miniStats = [
    { label: "Sessions", value: String(calls) },
    { label: "Latency", value: avgLatency !== null ? formatLatency(avgLatency) : "—" },
    { label: "Success", value: successRate !== null ? `${Math.round(successRate * 100)}%` : "—" },
    { label: "Last call", value: lastCall ? timeAgo(lastCall) : "never" },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 400, damping: 28 }}
      className={cn(
        "group relative flex flex-col p-5 overflow-hidden",
        "bg-card backdrop-blur-2xl border border-border rounded-[1.75rem]",
        "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)]",
        "transition-colors duration-300 hover:border-primary/30",
        isDeleting && "opacity-50 grayscale pointer-events-none"
      )}
    >
      {/* Hover glow */}
      <div className="absolute -top-24 -right-24 w-56 h-56 bg-primary/10 blur-[70px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Identity row */}
      <div className="relative z-10 flex items-center gap-3 min-w-0">
        <div className="flex items-center justify-center w-11 h-11 shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-inner">
          <Icon className="w-5 h-5 text-primary" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-foreground tracking-tight leading-tight truncate">
              {agent.agent_name}
            </h3>
            <span className="relative flex h-2 w-2 shrink-0" title="Active">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1 min-w-0">
            <span className="font-mono text-[10px] text-muted-foreground uppercase">
              {agent.agent_id.slice(0, 8)}
            </span>
            <span className="w-1 h-1 rounded-full bg-muted shrink-0" />
            <span className="text-[11px] text-muted-foreground truncate">{meta.label}</span>
            <span className="w-1 h-1 rounded-full bg-muted shrink-0" />
            <span className="text-[11px] font-mono text-muted-foreground truncate">{model}</span>
          </div>
        </div>
        {canDelete && (
          <AnimatePresence mode="wait" initial={false}>
            {showConfirm ? (
              <motion.span
                key="confirm"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                className="flex items-center gap-1 shrink-0"
              >
                <button
                  onClick={() => {
                    deleteMutation.mutate(agent.agent_id, {
                      onSuccess: () => notify.success("Agent deleted", { description: agent.agent_name }),
                    });
                    setShowConfirm(false);
                  }}
                  disabled={isDeleting}
                  className="flex items-center gap-1 px-2.5 h-8 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-semibold transition-all"
                  aria-label="Confirm delete"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted text-muted-foreground border border-border transition-all"
                  aria-label="Cancel delete"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </motion.span>
            ) : (
              <motion.button
                key="delete"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 8 }}
                onClick={() => setShowConfirm(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-all shrink-0 md:opacity-0 md:group-hover:opacity-100"
                aria-label={`Delete ${agent.agent_name}`}
                title="Delete agent"
              >
                <Trash2 className="w-4 h-4" />
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Telemetry strip */}
      <dl className="relative z-10 grid grid-cols-4 gap-2 mt-4 rounded-2xl bg-muted/50 border border-border px-3 py-2.5">
        {miniStats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold truncate">
              {stat.label}
            </dt>
            <dd className="text-[13px] font-mono text-foreground truncate mt-0.5" title={stat.value}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Actions */}
      <div className="relative z-10 flex items-center gap-2 mt-3">
        <Link
          href={`/agents/${agent.agent_id}`}
          className="flex-1 flex justify-center items-center gap-1.5 px-3 h-10 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold shadow-md hover:shadow-lg transition-all"
          aria-label={`Open ${agent.agent_name}`}
        >
          Open <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
        <Link
          href={`/agents/${agent.agent_id}/configure`}
          aria-label={`Configure ${agent.agent_name}`}
          title="Configure"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <Settings2 className="w-4 h-4" />
        </Link>
        <Link
          href={`/playground?agent=${agent.agent_id}&mode=talk`}
          aria-label={`Talk to ${agent.agent_name}`}
          title="Talk in Playground"
          className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted/60 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
        >
          <PhoneCall className="w-4 h-4" />
        </Link>
      </div>
    </motion.div>
  );
});
