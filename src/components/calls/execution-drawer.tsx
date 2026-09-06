"use client";

import { Activity, Bot, Copy, ExternalLink, PhoneIncoming, PhoneOutgoing, User } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { useExecution } from "@/services/platform/executions";
import { Drawer } from "@/components/common/modal";
import { ProgressBar } from "@/components/common/progress-bar";
import { StatusBadge } from "./status-badge";
import { displayCallerNumber, formatDuration, formatLatency, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ExecutionDrawerProps {
  executionId: string | null;
  onClose: () => void;
}

function LatencyBar({ label, ms, maxMs }: { label: string; ms: number; maxMs: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <ProgressBar value={maxMs > 0 ? Math.max(4, (ms / maxMs) * 100) : 0} />
      <span className="w-16 shrink-0 text-right text-xs font-mono text-foreground">{formatLatency(ms)}</span>
    </div>
  );
}

function KeyValueBlock({ title, data }: { title: string; data: Record<string, unknown> | null | undefined }) {
  if (!data) return null;
  const entries = Object.entries(data);
  if (entries.length === 0) return null;
  return (
    <div>
      <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-2">{title}</h4>
      <div className="rounded-2xl border border-border bg-muted/40 p-4 space-y-1.5">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 text-sm">
            <span className="font-mono text-xs text-muted-foreground shrink-0">{key}</span>
            <span className="text-foreground text-right break-all">
              {typeof value === "object" ? JSON.stringify(value) : String(value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ExecutionDrawer({ executionId, onClose }: ExecutionDrawerProps) {
  const open = executionId !== null;
  const { data: execution, isLoading } = useExecution(executionId ?? "", open);
  const [transcriptQuery, setTranscriptQuery] = useState("");
  const [prevId, setPrevId] = useState<string | null>(null);
  if (prevId !== executionId) {
    setPrevId(executionId);
    if (transcriptQuery !== "") setTranscriptQuery("");
  }

  const copy = async (value: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const ta = document.createElement("textarea");
        ta.value = value;
        ta.setAttribute("readonly", "");
        ta.style.position = "absolute";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      toast.success(`${label} copied`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const latency = execution?.latency;
  const maxLatency = latency ? Math.max(latency.transcriber_ms, latency.llm_ms, latency.synthesizer_ms, 1) : 1;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      label="Call details"
      wide
      title={
        <div className="min-w-0">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">Call details</p>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold tracking-tight text-foreground truncate">
              {execution ? displayCallerNumber(execution.to_number, "Unknown caller") : "Loading…"}
            </h3>
            {execution?.execution_id && (
              <button
                onClick={() => copy(execution.execution_id, "Execution ID")}
                aria-label="Copy execution ID"
                className="p-1.5 rounded-lg border border-border bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {execution?.execution_id && (
            <p className="text-[11px] font-mono text-muted-foreground truncate mt-1">{execution.execution_id}</p>
          )}
        </div>
      }
    >
      <div className="p-6 space-y-6">
              {isLoading || !execution ? (
                <div className="space-y-4 animate-pulse">
                  <div className="h-6 w-32 rounded-full bg-muted" />
                  <div className="h-24 rounded-2xl bg-muted" />
                  <div className="h-40 rounded-2xl bg-muted" />
                </div>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={execution.status} />
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border border-border bg-muted/50 text-muted-foreground">
                      {execution.direction === "outbound" ? (
                        <PhoneOutgoing className="w-3.5 h-3.5" />
                      ) : (
                        <PhoneIncoming className="w-3.5 h-3.5" />
                      )}
                      {execution.direction}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {timeAgo(execution.started_at)} · {formatDuration(execution.duration_s)}
                    </span>
                    <Link
                      href={`/agents/${execution.agent_id}`}
                      onClick={onClose}
                      className="inline-flex items-center gap-1 text-xs font-mono text-ember-700 dark:text-ember-300 hover:underline underline-offset-4"
                    >
                      Agent <ExternalLink aria-hidden="true" className="w-3 h-3" />
                    </Link>
                    {execution.batch_id && (
                      <Link
                        href={`/batches/${execution.batch_id}`}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 text-xs font-mono text-ember-700 dark:text-ember-300 hover:underline underline-offset-4"
                      >
                        Batch <ExternalLink aria-hidden="true" className="w-3 h-3" />
                      </Link>
                    )}
                  </div>

                  {execution.summary && (
                    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm leading-relaxed text-foreground">
                      {execution.summary}
                    </div>
                  )}

                  {latency && (
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-2">
                        <Activity className="w-3.5 h-3.5" /> Latency breakdown
                      </h4>
                      <div className="space-y-2.5">
                        <LatencyBar label="Transcriber" ms={latency.transcriber_ms} maxMs={maxLatency} />
                        <LatencyBar label="LLM" ms={latency.llm_ms} maxMs={maxLatency} />
                        <LatencyBar label="Synthesizer" ms={latency.synthesizer_ms} maxMs={maxLatency} />
                        <div className="flex items-center justify-between pt-1 text-sm">
                          <span className="text-muted-foreground">End-to-end</span>
                          <span className="font-mono font-semibold text-foreground">
                            {formatLatency(latency.e2e_ms)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <h4 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                        Transcript
                      </h4>
                      {execution.transcript.length > 0 && (
                        <input
                          value={transcriptQuery}
                          onChange={(event) => setTranscriptQuery(event.target.value)}
                          placeholder="Filter transcript…"
                          aria-label="Filter transcript"
                          className="h-8 px-3 bg-card border border-border rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-ember-400/50 w-40"
                        />
                      )}
                    </div>
                    {execution.transcript.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No transcript captured for this call.</p>
                    ) : (
                      <div className="space-y-3">
                        {execution.transcript
                          .filter((turn) =>
                            transcriptQuery.trim()
                              ? turn.text.toLowerCase().includes(transcriptQuery.trim().toLowerCase())
                              : true
                          )
                          .map((turn, index) => (
                          <div
                            key={index}
                            className={cn("flex", turn.role === "agent" ? "justify-start" : "justify-end")}
                          >
                            <div
                              className={cn(
                                "max-w-[90%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed break-words",
                                turn.role === "agent"
                                  ? "bg-muted/60 border border-border text-foreground rounded-tl-sm"
                                  : "bg-primary text-primary-foreground rounded-tr-sm"
                              )}
                            >
                              <div className="flex items-center gap-1.5 mb-1 opacity-70">
                                {turn.role === "agent" ? (
                                  <Bot className="w-3 h-3" />
                                ) : (
                                  <User className="w-3 h-3" />
                                )}
                                <span className="text-[10px] uppercase font-mono tracking-wider">
                                  {turn.role === "agent" ? "Agent" : "Caller"}
                                </span>
                                {typeof turn.ts === "number" && (
                                  <span className="text-[10px] font-mono">· {formatDuration(turn.ts)}</span>
                                )}
                              </div>
                              {turn.text}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <KeyValueBlock title="Extracted data" data={execution.extracted_data} />
                  <KeyValueBlock
                    title="Call variables"
                    data={execution.variables as Record<string, unknown>}
                  />
                </>
              )}
      </div>
    </Drawer>
  );
}
