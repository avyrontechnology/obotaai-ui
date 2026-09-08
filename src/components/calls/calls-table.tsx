"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight, PhoneIncoming, PhoneOutgoing } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { displayCallerNumber, formatDuration, formatLatency, timeAgo } from "@/lib/format";
import type { Execution } from "@/lib/schemas/platform";
import { cn } from "@/lib/utils";

interface CallsTableProps {
  executions: Execution[];
  agentNames: Map<string, string>;
  onSelect: (id: string) => void;
}

export const CallsTable = memo(function CallsTable({ executions, agentNames, onSelect }: CallsTableProps) {
  return (
    <div className="flex flex-col min-h-0 gap-3 md:gap-0">
      <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b border-border -mx-px">
        <div className="col-span-3">Recipient</div>
        <div className="col-span-3">Agent · Direction</div>
        <div className="col-span-2">Status</div>
        <div className="col-span-2">Duration · E2E</div>
        <div className="col-span-2 text-right">Placed</div>
      </div>

      <AnimatePresence initial={false}>
        {executions.map((execution, index) => (
          <motion.button
            key={execution.execution_id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => onSelect(execution.execution_id)}
            aria-label={`Open call ${execution.execution_id}`}
            className={cn(
              "grid grid-cols-2 md:grid-cols-12 gap-2 md:gap-4 md:items-center p-4 md:px-6 md:py-4 text-left transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
              // Mobile: card. Desktop: row in divided list
              "bg-card border border-border rounded-3xl md:rounded-none md:border-0 md:border-b md:last:border-b-0 hover:bg-muted/60",
              index === 0 && "md:rounded-t-3xl",
              index === executions.length - 1 && "md:rounded-b-3xl"
            )}
          >
            <div className="col-span-2 md:col-span-3 flex items-center gap-2 min-w-0">
              <div className="flex flex-col min-w-0">
                <span className="font-mono text-sm text-foreground truncate">{displayCallerNumber(execution.to_number)}</span>
                {execution.from_number && (
                  <span className="text-[10px] font-mono text-muted-foreground truncate opacity-80 mt-0.5">
                    from {displayCallerNumber(execution.from_number)}
                  </span>
                )}
              </div>
              <span title={execution.direction} className="inline-flex md:hidden items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-muted-foreground shrink-0">
                {execution.direction === "outbound" ? (
                  <PhoneOutgoing className="w-3 h-3" aria-hidden="true" />
                ) : (
                  <PhoneIncoming className="w-3 h-3" aria-hidden="true" />
                )}
                {execution.direction === "outbound" ? "Out" : "In"}
              </span>
              <span title={execution.direction} className="hidden md:inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted border border-border shrink-0">
                {execution.direction === "outbound" ? (
                  <PhoneOutgoing className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                ) : (
                  <PhoneIncoming className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                )}
              </span>
            </div>
            <div className="col-span-2 md:col-span-3 text-sm text-muted-foreground truncate min-w-0">
              {agentNames.get(execution.agent_id) ?? `${execution.agent_id.slice(0, 8)}…`}
            </div>
            <div className="col-span-1 md:col-span-2">
              <StatusBadge status={execution.status} />
            </div>
            <div className="col-span-1 md:col-span-2 text-xs font-mono text-muted-foreground">
              {formatDuration(execution.duration_s)} · {formatLatency(execution.latency?.e2e_ms)}
            </div>
            <div className="col-span-2 md:col-span-2 flex items-center justify-between md:justify-end gap-2 text-xs text-muted-foreground">
              <time dateTime={execution.started_at} title={execution.started_at} className="tabular-nums">
                {timeAgo(execution.started_at)}
              </time>
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 shrink-0" aria-hidden="true" />
            </div>
          </motion.button>
        ))}
      </AnimatePresence>
    </div>
  );
});
