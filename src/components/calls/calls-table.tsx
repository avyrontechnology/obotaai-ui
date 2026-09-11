"use client";

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { StatusBadge } from "./status-badge";
import { displayCallerNumber, formatDuration, formatLatency, timeAgo } from "@/lib/format";
import type { Execution } from "@/lib/schemas/platform";
import { cn } from "@/lib/utils";

interface CallsTableProps {
  executions: Execution[];
  agentNames: Map<string, string>;
  /** agent_id → pipeline model (llm.model ?? s2s.model). Absent = unknown, shown as "—". */
  agentModels?: Map<string, string>;
  onSelect: (id: string) => void;
}

function DirectionBadge({ direction }: { direction: string }) {
  const inbound = direction === "inbound";
  return (
    <span
      title={direction}
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap",
        inbound
          ? "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
          : "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20"
      )}
    >
      {inbound ? "Inbound" : "Outbound"}
    </span>
  );
}

/**
 * Measured summary only: the stored summary, else the first non-empty
 * transcript turn as a snippet, else an honest "—". Never synthesized.
 */
function summarySnippet(execution: Execution): string {
  if (execution.summary && execution.summary.trim() !== "") return execution.summary;
  const first = (execution.transcript ?? []).find((turn) => turn.text.trim() !== "")?.text ?? "";
  return first !== "" ? first : "—";
}

export const CallsTable = memo(function CallsTable({ executions, agentNames, agentModels, onSelect }: CallsTableProps) {
  return (
    <div className="flex flex-col min-h-0 gap-3 lg:gap-0">
      <div className="hidden lg:grid lg:grid-cols-12 lg:gap-3 xl:gap-4 px-4 xl:px-6 py-3 text-[11px] font-mono uppercase tracking-widest text-muted-foreground bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b border-border">
        <div className="lg:col-span-2 truncate">Caller / Recipient</div>
        <div className="lg:col-span-2 truncate">Agent Pipeline</div>
        <div className="lg:col-span-1 truncate">Direction</div>
        <div className="lg:col-span-2 xl:col-span-1 truncate">Status</div>
        <div className="lg:col-span-2 truncate">Duration &amp; E2E</div>
        <div className="lg:col-span-1 xl:col-span-2 truncate">Summary</div>
        <div className="lg:col-span-1 truncate">Placed</div>
        <div className="lg:col-span-1 text-right truncate">Actions</div>
      </div>

      <AnimatePresence initial={false}>
        {executions.map((execution, index) => {
          // Counterparty is direction-aware: inbound shows the caller
          // (from_number), outbound shows the recipient (to_number).
          const counterparty =
            execution.direction === "inbound" ? execution.from_number : execution.to_number;
          const turns = (execution.transcript ?? []).length;
          const snippet = summarySnippet(execution);
          const durationLabel = `${formatDuration(execution.duration_s)} (E2E ${formatLatency(execution.latency?.e2e_ms)})`;
          return (
            <motion.button
              key={execution.execution_id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => onSelect(execution.execution_id)}
              aria-label={`Open call ${execution.execution_id}`}
              className={cn(
                "grid grid-cols-2 lg:grid-cols-12 gap-x-2 gap-y-1.5 lg:gap-3 xl:gap-4 lg:items-center p-4 lg:px-4 xl:px-6 lg:py-4 text-left transition-colors group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
                // Mobile: card. Desktop: row in divided list
                "bg-card border border-border rounded-3xl lg:rounded-none lg:border-0 lg:border-b lg:last:border-b-0 hover:bg-muted/60",
                index === 0 && "lg:rounded-t-3xl",
                index === executions.length - 1 && "lg:rounded-b-3xl"
              )}
            >
              <div className="col-span-2 lg:col-span-2 flex flex-col min-w-0">
                <span className="font-mono text-sm text-foreground truncate" title={counterparty ?? undefined}>
                  {displayCallerNumber(counterparty)}
                </span>
                <span className="text-[10px] font-mono text-muted-foreground truncate opacity-80 mt-0.5 tabular-nums">
                  {turns > 0 ? `${turns} turn${turns === 1 ? "" : "s"}` : "No transcript"}
                </span>
              </div>
              <div className="col-span-2 lg:col-span-2 flex flex-col min-w-0">
                <span
                  className="text-sm text-muted-foreground truncate"
                  title={agentNames.get(execution.agent_id) ?? execution.agent_id}
                >
                  {agentNames.get(execution.agent_id) ?? `${execution.agent_id.slice(0, 8)}…`}
                </span>
                <span
                  className="text-[10px] font-mono text-muted-foreground truncate opacity-80 mt-0.5"
                  title={agentModels?.get(execution.agent_id) ?? undefined}
                >
                  {agentModels?.get(execution.agent_id) ?? "—"}
                </span>
              </div>
              <div className="col-span-1 lg:col-span-1 min-w-0 flex lg:block">
                <DirectionBadge direction={execution.direction} />
              </div>
              <div className="col-span-1 lg:col-span-2 xl:col-span-1 min-w-0 flex lg:block justify-end">
                <StatusBadge status={execution.status} />
              </div>
              <div
                className="col-span-1 lg:col-span-2 text-xs font-mono text-muted-foreground truncate min-w-0 tabular-nums"
                title={durationLabel}
              >
                {durationLabel}
              </div>
              <div
                className="col-span-1 lg:col-span-1 xl:col-span-2 text-xs text-muted-foreground truncate min-w-0"
                title={snippet}
              >
                {snippet}
              </div>
              <div className="col-span-2 lg:col-span-1 flex items-center justify-between lg:justify-start gap-2 text-xs text-muted-foreground min-w-0">
                <time dateTime={execution.started_at} title={execution.started_at} className="tabular-nums truncate">
                  {timeAgo(execution.started_at)}
                </time>
                <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 shrink-0 lg:hidden" aria-hidden="true" />
              </div>
              <div className="hidden lg:flex lg:col-span-1 items-center justify-end min-w-0">
                <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 shrink-0" aria-hidden="true" />
              </div>
            </motion.button>
          );
        })}
      </AnimatePresence>
    </div>
  );
});
