"use client";

import { useState, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Terminal, Cpu, Trash2, Settings2, Activity, Power, X, Check } from "lucide-react";
import { Agent, useDeleteAgent } from "@/services/api";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

interface AgentCardProps {
  agent: Agent;
  sessions?: number;
}

export const AgentCard = memo(function AgentCard({ agent, sessions }: AgentCardProps) {
  const deleteMutation = useDeleteAgent();
  const [showConfirm, setShowConfirm] = useState(false);
  const isDeleting = deleteMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "group relative flex flex-col h-[280px] p-6 overflow-hidden",
        "bg-card backdrop-blur-2xl border border-border rounded-[2rem]",
        "shadow-[0_8px_40px_-12px_rgba(0,0,0,0.1)]",
        "transition-all duration-500",
        isDeleting && "opacity-50 grayscale pointer-events-none"
      )}
    >
      {/* Dynamic Background Glows */}
      <div className="absolute -top-32 -right-32 w-64 h-64 bg-primary/20 dark:bg-primary/10 blur-[80px] rounded-full group-hover:bg-primary/30 transition-colors duration-700 pointer-events-none" />
      <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-secondary/20 dark:bg-secondary/10 blur-[80px] rounded-full group-hover:bg-secondary/30 transition-colors duration-700 pointer-events-none" />
      
      {/* Grain Overlay for Texture */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] mix-blend-overlay pointer-events-none bg-[url('/noise.svg')]" />

      {/* Header section */}
      <div className="relative z-10 flex justify-between items-start gap-3 mb-auto">
        <div className="flex gap-4 items-center min-w-0">
          <motion.div 
            whileHover={{ rotate: 15 }}
            className="flex items-center justify-center w-12 h-12 shrink-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 shadow-inner backdrop-blur-md"
          >
            {agent.agent_type === "voice" ? (
              <Mic className="w-5 h-5 text-primary" />
            ) : agent.agent_type === "s2s" ? (
              <Cpu className="w-5 h-5 text-primary" />
            ) : (
              <Terminal className="w-5 h-5 text-primary" />
            )}
          </motion.div>
          
          <div className="flex flex-col min-w-0">
            <h3 className="text-xl font-medium text-foreground tracking-tight leading-tight truncate">
              {agent.agent_name}
            </h3>
            <span className="text-xs font-mono text-muted-foreground mt-1 uppercase tracking-wider">
              {agent.agent_id.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center justify-center w-8 h-8 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </div>

      {/* Stats Section — real session counts; model replaces fake uptime */}
      <div className="relative z-10 grid grid-cols-2 gap-3 mt-6 mb-6">
        <div className="flex flex-col p-4 rounded-2xl bg-muted/50 border border-border backdrop-blur-sm group-hover:bg-muted transition-colors">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5" /> Sessions
          </span>
          <span className="text-2xl font-light tracking-tighter text-foreground">
            {sessions ?? "—"}
          </span>
        </div>
        <div className="flex flex-col p-4 rounded-2xl bg-muted/50 border border-border backdrop-blur-sm group-hover:bg-muted transition-colors">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold mb-2 flex items-center gap-1.5">
            <Power className="w-3.5 h-3.5" /> Model
          </span>
          <span className="text-sm font-mono font-light tracking-tight text-foreground truncate">
            {agent.agent_config.llm?.model ?? agent.agent_config.s2s?.model ?? "—"}
          </span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 flex items-center justify-between pt-2">
        <Link 
          href={`/agents/${agent.agent_id}`}
          className="flex-1 mr-3 flex justify-center items-center gap-2 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg hover:shadow-xl transition-all"
          aria-label={`Configure ${agent.agent_name}`}
        >
          <Settings2 className="w-4 h-4" />
          <span>Configure</span>
        </Link>
        <AnimatePresence mode="wait">
          {showConfirm ? (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center gap-2"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => {
                  deleteMutation.mutate(agent.agent_id, {
                    onSuccess: () => notify.success("Agent deleted", { description: agent.agent_name }),
                  });
                  setShowConfirm(false);
                }}
                disabled={isDeleting}
                className="flex items-center justify-center gap-1.5 px-3 h-10 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-all shadow-sm"
                aria-label="Confirm delete"
              >
                <Check className="w-3.5 h-3.5" />
                Confirm
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowConfirm(false)}
                className="flex items-center justify-center w-10 h-10 rounded-xl bg-muted text-muted-foreground border border-border transition-all"
                aria-label="Cancel delete"
              >
                <X className="w-4 h-4" />
              </motion.button>
            </motion.div>
          ) : (
            <motion.button
              key="delete"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setShowConfirm(true)}
              className="flex items-center justify-center w-12 h-12 rounded-xl bg-red-500/10 text-red-600 dark:text-red-500 hover:bg-red-600 hover:text-white border border-red-500/20 transition-all shadow-sm hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]"
              aria-label={`Delete ${agent.agent_name}`}
            >
              <Trash2 className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
});
