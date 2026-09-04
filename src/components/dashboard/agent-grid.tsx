"use client";

import { useMemo } from "react";
import { useAgents } from "@/services/api";
import { AgentCard } from "./agent-card";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ServerCrash, Plus, Mic, Sparkles } from "lucide-react";
import Link from "next/link";
import { useExecutions } from "@/services/platform/executions";

export function AgentGrid() {
  const { data: agents, isLoading, error, refetch } = useAgents();
  // Single aggregate fetch for card session counts — no per-card queries.
  const { data: executions } = useExecutions();
  const sessionsByAgent = useMemo(() => {
    const map = new Map<string, number>();
    (executions ?? []).forEach((execution) => {
      map.set(execution.agent_id, (map.get(execution.agent_id) ?? 0) + 1);
    });
    return map;
  }, [executions]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 dark:bg-primary/40 blur-[40px] rounded-full animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
        </div>
        <p className="font-mono text-sm tracking-[0.2em] uppercase animate-pulse text-muted-foreground">
          Syncing Neural Link...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center min-h-[500px] gap-6 p-10 relative overflow-hidden rounded-[2.5rem] border border-red-500/20 bg-red-500/5 backdrop-blur-2xl"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(239,68,68,0.15)_0%,transparent_70%)] pointer-events-none" />
        <motion.div 
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="relative z-10 w-24 h-24 rounded-3xl bg-red-500/10 flex items-center justify-center border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.2)] backdrop-blur-md"
        >
          <ServerCrash className="w-10 h-10 text-red-500" strokeWidth={1.5} />
        </motion.div>
        <div className="text-center relative z-10 space-y-3 max-w-lg">
          <h2 className="text-3xl font-medium tracking-tight text-foreground">Connection Severed</h2>
          <p className="font-mono text-sm leading-relaxed text-red-600/80 dark:text-red-400/80">
            Failed to retrieve the agent matrix. The neural backend is unresponsive. 
            Verify that the OtobaAI API server is active and the network channel is open.
          </p>
        </div>
        <button 
          onClick={() => refetch()}
          className="relative z-10 px-8 py-3 mt-4 rounded-xl bg-red-600 text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:shadow-[0_0_30px_rgba(239,68,68,0.6)] hover:bg-red-700 transition-all font-semibold"
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
    hidden: { opacity: 0, y: 30, scale: 0.95 },
    show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring" as const, stiffness: 350, damping: 25 } }
  };

  return (
    <div className="w-full">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 mt-8 relative z-10 gap-6">
        <div>
          <motion.h2 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl md:text-5xl font-medium text-foreground tracking-tight mb-3 flex items-center gap-3"
          >
            Active <span className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-ember-700 via-primary to-ember-600 dark:from-primary dark:via-ember-300 dark:to-ember-300">Agents</span>
            <Sparkles className="w-8 h-8 text-primary animate-pulse" />
          </motion.h2>
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm font-mono text-muted-foreground uppercase tracking-widest flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Monitoring {agents?.length || 0} deployed instances
          </motion.p>
        </div>
        <Link href="/agents/new">
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            className="group flex items-center gap-3 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-xl hover:shadow-2xl transition-all"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/20 group-hover:bg-white/30 transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <span>New Agent</span>
          </motion.button>
        </Link>
      </div>

      {!hasAgents ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center min-h-[400px] bg-card backdrop-blur-2xl p-12 relative overflow-hidden rounded-[2.5rem] border border-border shadow-2xl"
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(251,108,0,0.05)_0%,transparent_60%)]" />
          <motion.div 
            animate={{ y: [0, -10, 0] }}
            transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
            className="w-24 h-24 rounded-[2rem] bg-muted flex items-center justify-center mb-8 border border-border shadow-inner relative z-10 backdrop-blur-md"
          >
            <Mic className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
          </motion.div>
          <h3 className="text-2xl font-semibold text-foreground mb-3 relative z-10 tracking-tight">No active agents</h3>
          <p className="text-muted-foreground text-base max-w-md text-center mb-10 relative z-10 leading-relaxed">
            Initialize your first neural voice agent to begin processing conversational requests in real-time.
          </p>
        <Link href="/agents/new" aria-label="Create new agent">
            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold shadow-xl hover:shadow-2xl transition-all relative z-10"
            >
              Initialize Agent Matrix
            </motion.button>
          </Link>
        </motion.div>
      ) : (
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10"
        >
          <AnimatePresence mode="popLayout">
            {agents.map((agent) => (
              <motion.div key={agent.agent_id} variants={itemVariants} layout="position">
                <AgentCard agent={agent} sessions={sessionsByAgent.get(agent.agent_id) ?? 0} />
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
