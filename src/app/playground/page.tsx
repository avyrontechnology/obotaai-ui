"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PhoneCall, PhoneOff, Activity, RefreshCw, RadioReceiver, AudioLines, Loader2, Mic, MessageSquare } from "lucide-react";
import Link from "next/link";
import { LiveTalk } from "@/components/playground/live-talk";
import { ChatTalk } from "@/components/playground/chat-talk";
import { useSearchParams } from "next/navigation";
import { AudioVisualizer } from "@/components/playground/audio-visualizer";
import { StatusBadge, isTerminal } from "@/components/calls/status-badge";
import { PageHeader } from "@/components/common/page-header";
import { useAgents } from "@/services/api";
import { useExecution, useSimulateCall } from "@/services/platform/executions";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  queued: "Dialing…",
  ringing: "Ringing…",
  in_progress: "Live — speaking",
};

function formatCallTs(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `00:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}


export default function PlaygroundPage() {
  return (
    <Suspense>
      <PlaygroundContent />
    </Suspense>
  );
}

function PlaygroundContent() {
  const searchParams = useSearchParams();
  const deepLinkedAgent = searchParams.get("agent") ?? "";
  const deepLinkedMode = searchParams.get("mode");
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  const [modeOverride, setModeOverride] = useState<"simulate" | "live" | "chat" | null>(null);
  const [toNumber, setToNumber] = useState("+911234567890");
  const [callerName, setCallerName] = useState("Asha");
  const [executionId, setExecutionId] = useState<string | null>(null);
  const [volume, setVolume] = useState(0);

  // Deep link from agent overview (?agent=) wins over the default first agent.
  // Manual selection overrides both — no effect-driven setState.
  const agentId = agentOverride ?? deepLinkedAgent;
  const setAgentId = (value: string) => setAgentOverride(value);
  const rawMode = modeOverride ?? (deepLinkedMode === "live" ? "live" : "simulate");

  const effectiveAgentId = agentId || agents?.[0]?.agent_id || "";
  const effectiveAgent = (agents ?? []).find((a) => a.agent_id === effectiveAgentId);
  // Typed chat rides the realtime text path, which pipeline sockets don't
  // consume — fall back to simulate rather than a dead chat box.
  const chatSupported = (effectiveAgent?.agent_type ?? "voice") === "s2s";
  const mode = rawMode === "chat" && !chatSupported ? "simulate" : rawMode;

  const simulate = useSimulateCall();
  const {
    data: execution,
    refetch,
    isFetching,
  } = useExecution(executionId ?? "", executionId !== null);

  const live = executionId !== null && (!execution || !isTerminal(execution.status));

  // Live-tail the running call; volume animation follows call activity.
  useEffect(() => {
    if (!live) {
      const id = requestAnimationFrame(() => setVolume(0));
      return () => cancelAnimationFrame(id);
    }
    const poll = setInterval(() => refetch(), 1500);
    const animate = setInterval(() => setVolume(Math.random() * 0.8 + 0.2), 100);
    return () => {
      clearInterval(poll);
      clearInterval(animate);
    };
  }, [live, refetch]);

  const transcript = useMemo(
    () =>
      (execution?.transcript ?? []).map((turn) => ({
        text: turn.text,
        isAgent: turn.role === "agent",
        timestamp: formatCallTs(turn.ts),
      })),
    [execution]
  );

  const placeCall = async () => {
    if (!effectiveAgentId || !toNumber.trim()) return;
    try {
      const result = await simulate.mutateAsync({
        agent_id: effectiveAgentId,
        to_number: toNumber.trim(),
        variables: callerName.trim() ? { customer_name: callerName.trim() } : {},
        delay_scale: 2.5,
      });
      setExecutionId(result.execution_id);
    } catch {
      // Surfaced below via simulate.error.
    }
  };

  const resetStudio = () => {
    setExecutionId(null);
    setVolume(0);
    simulate.reset();
  };

  const statusText = execution
    ? STATUS_LABEL[execution.status] ?? execution.status
    : simulate.isPending
      ? "Dialing…"
      : "Ready";

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-24 px-4 md:px-8">
      {/* Header */}
      <PageHeader
        title="Neural"
        accent="Playground"
        description={
          <span className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            {mode === "live"
              ? "Real microphone conversation over the voice websocket"
              : "Simulation runner: live backend executions, no telephony"}
          </span>
        }
        className="mb-8"
        actions={
          <Link
            href="/calls"
            className="h-11 px-4 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground font-medium text-sm transition-all hover:bg-accent inline-flex items-center gap-2"
          >
            <AudioLines className="w-4 h-4" />
            <span>Call History</span>
          </Link>
        }
      />

      {/* Mode tabs */}
      <div className="flex items-center gap-2 mb-6" role="tablist" aria-label="Playground mode">
        {(
          [
            { id: "simulate", label: "Simulate", hint: "Scripted run, no mic", icon: PhoneCall },
            { id: "live", label: "Live talk", hint: "Real mic conversation", icon: Mic },
            { id: "chat", label: "Chat", hint: "Text with a realtime agent", icon: MessageSquare },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            onClick={() => setModeOverride(option.id)}
            role="tab"
            aria-selected={mode === option.id}
            title={option.hint}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-medium border transition-all",
              mode === option.id
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-accent"
            )}
          >
            <option.icon className="w-4 h-4" />
            {option.label}
          </button>
        ))}
      </div>
      {rawMode === "chat" && !chatSupported && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Text chat is served for realtime agents — this one runs a pipeline, so simulation is shown
          instead. Switch to a realtime agent to chat.
        </div>
      )}

      {mode === "chat" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-w-2xl">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Agent</span>
              <select
                value={effectiveAgentId}
                onChange={(event) => setAgentId(event.target.value)}
                disabled={agentsLoading}
                aria-label="Agent to chat with"
                className={cn(fieldStyles.field, "disabled:opacity-50")}
              >
                {(agents ?? [])
                  .filter((agent) => agent.agent_type === "s2s")
                  .map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {effectiveAgentId && (
            <ChatTalk
              key={`chat-${effectiveAgentId}`}
              agentId={effectiveAgentId}
              agentName={effectiveAgent?.agent_name ?? "Agent"}
            />
          )}
        </>
      ) : mode === "live" ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 max-w-2xl">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Agent</span>
              <select
                value={effectiveAgentId}
                onChange={(event) => setAgentId(event.target.value)}
                disabled={agentsLoading}
                aria-label="Agent to talk with"
                className={cn(fieldStyles.field, "disabled:opacity-50")}
              >
                {(agents ?? []).map((agent) => (
                  <option key={agent.agent_id} value={agent.agent_id}>
                    {agent.agent_name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {(agents ?? []).length === 0 && !agentsLoading ? (
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              No agents exist yet.{" "}
              <Link href="/agents/new" className="underline underline-offset-2">
                Create one first
              </Link>
              .
            </div>
          ) : (
            effectiveAgentId && (
              <LiveTalk
                key={effectiveAgentId}
                agentId={effectiveAgentId}
                agentName={effectiveAgent?.agent_name ?? "Agent"}
              />
            )
          )}
        </>
      ) : (
        <>
      {/* Call configuration */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6"
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Agent</span>
          <select
            value={effectiveAgentId}
            onChange={(event) => setAgentId(event.target.value)}
            disabled={agentsLoading || live}
            aria-label="Agent to call with"
            className={cn(fieldStyles.field, "disabled:opacity-50")}
          >
            {(agents ?? []).map((agent) => (
              <option key={agent.agent_id} value={agent.agent_id}>
                {agent.agent_name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">To number</span>
          <input
            value={toNumber}
            onChange={(event) => setToNumber(event.target.value)}
            disabled={live}
            placeholder="+911234567890"
            aria-label="Recipient phone number"
            className={cn(fieldStyles.field, "font-mono disabled:opacity-50")}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Caller name</span>
          <input
            value={callerName}
            onChange={(event) => setCallerName(event.target.value)}
            disabled={live}
            placeholder="Asha"
            aria-label="Caller name variable"
            className={cn(fieldStyles.field, "disabled:opacity-50")}
          />
        </label>
        <div className="flex flex-col gap-1.5 justify-end">
          {execution && isTerminal(execution.status) ? (
            <button
              onClick={resetStudio}
              className="h-11 px-4 rounded-2xl bg-card border border-border text-foreground font-medium text-sm transition-all hover:bg-accent flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>New call</span>
            </button>
          ) : (
            <button
              onClick={placeCall}
              disabled={!effectiveAgentId || !toNumber.trim() || live || simulate.isPending}
              className="h-11 px-4 rounded-2xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
            >
              {simulate.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : live ? (
                <PhoneOff className="w-4 h-4" />
              ) : (
                <PhoneCall className="w-4 h-4" />
              )}
              <span>{simulate.isPending ? "Dialing…" : live ? "Call in progress…" : "Place call"}</span>
            </button>
          )}
        </div>
      </motion.div>

      {simulate.isError && (
        <div className="mb-6 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-700 dark:text-red-400">
          Failed to place the call. Is the backend running at the configured API URL?
        </div>
      )}
      {(agents ?? []).length === 0 && !agentsLoading && (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          No agents exist yet.{" "}
           <Link href="/agents/new" className="underline underline-offset-2">
            Create one first
          </Link>
          .
        </div>
      )}

      {/* Split Screen Layout */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
        {/* Left Column: Visualizer & Status */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
          className="flex-1 flex flex-col items-center justify-center bg-muted/40 backdrop-blur-2xl border border-border rounded-[2.5rem] p-8 shadow-[0_8px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] relative overflow-hidden group"
        >
          <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] pointer-events-none" />
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md aspect-square blur-[120px] rounded-full transition-colors duration-1000 ${live ? "bg-ember-400/10 dark:bg-ember-400/20" : "bg-ember-400/5 dark:bg-ember-400/10"}`}
          />

          <div className="absolute top-6 left-8 flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground">
            <RadioReceiver className="w-4 h-4" />
            <span>Simulation Node 01</span>
          </div>
          {execution && (
            <div className="absolute top-6 right-8">
              <StatusBadge status={execution.status} />
            </div>
          )}

          <div className="relative z-10 flex flex-col items-center justify-center flex-1 w-full mt-12">
            <AudioVisualizer isRecording={live} volume={volume} />
          </div>

          <div className="relative z-10 mt-16 pb-8">
            <div className="flex items-center justify-center w-24 h-24 rounded-full border bg-card border-border text-foreground shadow-[0_8px_20px_-8px_rgba(0,0,0,0.1)]">
              {isFetching && live ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : live ? (
                <Activity className="w-8 h-8 text-primary animate-pulse" />
              ) : (
                <PhoneCall className="w-8 h-8 text-muted-foreground" />
              )}
            </div>
            <div className="mt-6 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
              {statusText}
            </div>
          </div>
        </motion.div>

        {/* Right Column: Transcript */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.2 }}
          className="w-full lg:w-[400px] flex flex-col bg-muted/40 backdrop-blur-2xl border border-border rounded-[2.5rem] p-6 shadow-[0_8px_40px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_40px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          <div className="absolute inset-0 rounded-[2.5rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] pointer-events-none" />

          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border relative z-10">
            <h3 className="text-sm font-mono uppercase tracking-widest text-foreground flex items-center gap-2">
              <AudioLines className="w-4 h-4 text-ember-600 dark:text-ember-400" />
              Live Transcript
            </h3>
            <button
              onClick={resetStudio}
              aria-label="Clear studio"
              className="p-2 rounded-xl bg-card/50 text-muted-foreground hover:text-ember-700 dark:hover:text-ember-300 hover:bg-primary/10 transition-colors border border-transparent hover:border-primary/20"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scrollbar relative z-10 min-h-[200px]">
            {transcript.length === 0 ? (
              <p className="text-sm text-muted-foreground leading-relaxed">
                Pick an agent, enter a number and place a call. The transcript streams here as the backend
                simulation progresses.
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {transcript.map((msg, idx) => (
                  <motion.div
                    key={`${executionId}-${idx}`}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className={`flex flex-col ${msg.isAgent ? "items-start" : "items-end"}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`text-[10px] uppercase font-mono tracking-wider ${msg.isAgent ? "text-ember-700 dark:text-ember-300" : "text-emerald-700 dark:text-emerald-400"}`}
                      >
                        {msg.isAgent ? "Neural Agent" : "Caller"}
                      </span>
                      <span className="text-[9px] font-mono text-muted-foreground">{msg.timestamp}</span>
                    </div>
                    <div
                      className={`px-5 py-3.5 max-w-[90%] text-sm leading-relaxed break-words shadow-sm ${
                        msg.isAgent
                          ? "bg-card/80 border border-border text-foreground rounded-2xl rounded-tl-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                          : "bg-primary border border-border text-primary-foreground rounded-2xl rounded-tr-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </motion.div>
      </div>
        </>
      )}
    </div>
  );
}
