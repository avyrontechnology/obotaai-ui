"use client";

import { useMemo } from "react";
import { useAgents } from "@/services/api";
import { AgentCard, type FleetStats } from "./agent-card";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ServerCrash, Plus, Mic } from "lucide-react";
import Link from "next/link";
import { useExecutions } from "@/services/platform/executions";

export function AgentGrid() {
  const { data: agents, isLoading, error, refetch } = useAgents();
  // Single aggregate fetch for per-agent fleet telemetry — no per-card queries.
  const { data: executions } = useExecutions({ limit: 500 });
  const statsByAgent = useMemo(() => {
    const acc = new Map<string, { sessions: number; latencies: number[]; completed: number; last: string | null }>();
    (executions ?? []).forEach((execution) => {
      const entry = acc.get(execution.agent_id) ?? { sessions: 0, latencies: [], completed: 0, last: null };
      entry.sessions += 1;
      if (execution.latency && Number.isFinite(execution.latency.e2e_ms)) {
        entry.latencies.push(execution.latency.e2e_ms);
      }
      if (execution.status === "completed") entry.completed += 1;
      if (!entry.last || execution.started_at > entry.last) entry.last = execution.started_at;
      acc.set(execution.agent_id, entry);
    });
    const map = new Map<string, FleetStats>();
    acc.forEach((entry, agentId) => {
      map.set(agentId, {
        sessions: entry.sessions,
        avgLatencyMs:
          entry.latencies.length > 0
            ? Math.round(entry.latencies.reduce((a, b) => a + b, 0) / entry.latencies.length)
            : null,
        successRate: entry.sessions > 0 ? entry.completed / entry.sessions : null,
        lastCallAt: entry.last,
      });
    });
    return map;
  }, [executions]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] gap-6" aria-busy="true" aria-label="Loading OboFleet">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 blur-[40px] rounded-full animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10 motion-reduce:animate-none" aria-hidden="true" />
        </div>
        <p className="font-mono text-sm tracking-[0.2em] uppercase animate-pulse motion-reduce:animate-none text-muted-foreground">
          Syncing OboFleet...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col items-center justify-center min-h-[320px] gap-6 p-6 md:p-8 relative overflow-hidden rounded-3xl border border-red-500/20 bg-red-500/5"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15)_0%,transparent_70%)] pointer-events-none motion-reduce:hidden" aria-hidden="true" />
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          className="relative z-10 w-24 h-24 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20"
        >
          <ServerCrash className="w-10 h-10 text-red-500" strokeWidth={1.5} aria-hidden="true" />
        </motion.div>
        <div className="text-center relative z-10 space-y-3 max-w-lg">
          <h2 className="text-2xl md:text-3xl font-medium tracking-tight text-foreground">Connection Severed</h2>
          <p className="font-mono text-sm leading-relaxed text-red-600/80 dark:text-red-400/80">
            Failed to retrieve OboFleet. The neural backend is unresponsive. 
            Verify that the OtobaAI API server is active and the network channel is open.
          </p>
        </div>
        <button 
          onClick={() => refetch()}
          className="relative z-10 px-8 py-3 mt-4 rounded-xl bg-red-600 text-white shadow-lg hover:bg-red-700 transition-colors duration-200 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
        >
          Re-establish Link
        </button>
      </motion.div>
    );
  }

  const hasAgents = agents && agents.length > 0;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: 0.18 } }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-6 relative z-10 gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            OboFleet
          </h2>
          <p className="text-sm text-muted-foreground font-mono mt-0.5 uppercase tracking-widest flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 motion-reduce:animate-none" aria-hidden="true" />
            Monitoring {agents?.length || 0} deployed voices
          </p>
        </div>
        <Link
          href="/agents/new"
          className="flex items-center gap-2 px-5 h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl transition-all duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>Deploy Agent</span>
        </Link>
      </div>

      {!hasAgents ? (
        <motion.div 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center min-h-[320px] bg-card p-6 md:p-8 relative overflow-hidden rounded-3xl border border-border"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,108,0,0.05)_0%,transparent_60%)] motion-reduce:hidden" aria-hidden="true" />
          <motion.div 
            animate={{ y: [0, -6, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="w-24 h-24 rounded-3xl bg-muted flex items-center justify-center mb-6 border border-border shadow-inner relative z-10"
          >
            <Mic className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} aria-hidden="true" />
          </motion.div>
          <h3 className="text-2xl font-semibold text-foreground mb-3 relative z-10 tracking-tight">No voices in the fleet</h3>
          <p className="text-muted-foreground text-base max-w-md text-center mb-8 relative z-10 leading-relaxed">
            Deploy your first OboFleet voice to begin processing conversational requests in real-time.
          </p>
        <Link href="/agents/new" aria-label="Deploy your first agent">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/20 hover:bg-primary/90 hover:shadow-xl transition-all duration-200 relative z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
            >
              Deploy your first agent
            </motion.button>
          </Link>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex gap-4 overflow-x-auto overflow-y-hidden pb-2 snap-x custom-scrollbar relative z-10"
        >
          <AnimatePresence mode="popLayout">
            {agents.map((agent) => (
              <motion.div
                key={agent.agent_id}
                variants={itemVariants}
                layout="position"
                className="snap-start shrink-0 w-[min(340px,85vw)]"
              >
                <AgentCard
                  agent={agent}
                  sessions={statsByAgent.get(agent.agent_id)?.sessions ?? 0}
                  stats={statsByAgent.get(agent.agent_id) ?? null}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
