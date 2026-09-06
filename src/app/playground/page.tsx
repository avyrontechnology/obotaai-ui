"use client";

import { Suspense, useEffect, useState } from "react";
import { AudioLines, Mic, MessageSquareText, History, ChevronDown } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { LiveTalk } from "@/components/playground/live-talk";
import { ChatTalk } from "@/components/playground/chat-talk";
import { useCan } from "@/lib/rbac";
import { useSearchParams } from "next/navigation";
import { useAgents } from "@/services/api";
import { subscribePlaygroundBus } from "@/lib/playground-bus";
import { useMounted } from "@/lib/use-mounted";
import { cn } from "@/lib/utils";

type Mode = "talk" | "chat";

interface RecentSession {
  agentId: string;
  mode: Mode;
}

function normalizeMode(raw: string | null): Mode {
  return raw === "chat" ? "chat" : "talk";
}

function greetingFor(hour: number): string {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
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
  // Legacy ?mode=live alias and retired ?mode=simulate both land on talk.
  const deepLinkedMode = searchParams.get("mode");
  const { data: agents, isLoading: agentsLoading } = useAgents();
  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  const [modeOverride, setModeOverride] = useState<Mode | null>(null);

  // Deep link from agent overview (?agent=) wins over the default first agent.
  // Manual selection overrides both — no effect-driven setState.
  const agentId = agentOverride ?? deepLinkedAgent;
  const setAgentId = (value: string) => setAgentOverride(value);
  // Legacy ?mode=live alias and retired ?mode=simulate both land on talk.
  const mode = modeOverride ?? normalizeMode(deepLinkedMode);

  const effectiveAgentId = agentId || agents?.[0]?.agent_id || "";
  const effectiveAgent = (agents ?? []).find((a) => a.agent_id === effectiveAgentId);
  const agentType = effectiveAgent?.agent_type ?? "voice";
  // Text agents carry no audio pipeline, so Talk is unavailable for them.
  // Chat is served for every type (realtime native, pipeline via the
  // browser-leg text queue).
  const talkSupported = agentType === "voice" || agentType === "s2s";
  const activeMode: Mode = mode === "talk" && !talkSupported ? "chat" : mode;
  // Role gates must render identically during SSR and hydration. The session
  // query mounts in the layout, so its cache can already be warm when this
  // page hydrates (server saw logged-out, client sees member) — branching on
  // the raw role swaps <p> for <button> and crashes hydration. Gating on the
  // mount flag keeps both trees on the read-only branch until after hydrate.
  const liveAllowed = useCan("calls.live");
  const mounted = useMounted();
  const canLive = mounted && liveAllowed;

  // Session-only "continue where you left off" — updated from event
  // handlers only, never from an effect.
  const [recents, setRecents] = useState<RecentSession[]>([]);
  const remember = (nextAgentId: string, nextMode: Mode) => {
    setRecents((prev) =>
      [{ agentId: nextAgentId, mode: nextMode }, ...prev.filter((r) => r.agentId !== nextAgentId)].slice(0, 4)
    );
  };
  const selectAgent = (value: string) => {
    setAgentId(value);
    if (value) remember(value, activeMode);
  };
  const selectMode = (next: Mode) => {
    setModeOverride(next);
    if (effectiveAgentId) remember(effectiveAgentId, next);
  };
  const resume = (recent: RecentSession) => {
    setAgentId(recent.agentId);
    setModeOverride(recent.mode);
    remember(recent.agentId, recent.mode);
  };

  // Page-level feedback for shared-bus actions (no setState — toast only).
  useEffect(
    () =>
      subscribePlaygroundBus((event) => {
        if (event.type === "clear-transcript") toast.success("Transcript cleared");
      }),
    []
  );

  const greeting = greetingFor(new Date().getHours());

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] lg:h-full lg:min-h-0 lg:overflow-hidden max-w-7xl mx-auto w-full pt-12 lg:pt-8 pb-24 lg:pb-6 px-4 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8 lg:mb-5 shrink-0">
        <div>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground">
            <span suppressHydrationWarning>{greeting}</span>
          </h1>
          <p className="mt-2 text-muted-foreground">
            Ready when you are to test, iterate, and ship world-class voice experiences.
          </p>
        </div>
        <Link
          href="/calls"
          className="h-11 px-4 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground font-medium text-sm transition-all hover:bg-accent inline-flex items-center gap-2"
        >
          <AudioLines className="w-4 h-4" />
          <span>Call History</span>
        </Link>
      </div>

      {recents.length > 0 && (
        <div className="mb-8 lg:mb-5 shrink-0">
          <p className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
            <History className="w-3.5 h-3.5" /> Continuing
          </p>
          <div className="flex flex-wrap gap-2">
            {recents.map((recent) => {
              const agent = (agents ?? []).find((a) => a.agent_id === recent.agentId);
              if (!agent) return null;
              const isActive = recent.agentId === effectiveAgentId && recent.mode === activeMode;
              return (
                <button
                  key={recent.agentId}
                  onClick={() => resume(recent)}
                  aria-pressed={isActive}
                  className={cn(
                    "flex items-center gap-2.5 pl-1.5 pr-4 py-1.5 rounded-full border text-sm transition-all",
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                      : "bg-card text-foreground border-border hover:border-primary/40"
                  )}
                >
                  <span
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold shrink-0",
                      isActive ? "bg-primary-foreground/20" : "bg-gradient-to-br from-[#E73F1E] to-[#F9B637] text-white"
                    )}
                    aria-hidden="true"
                  >
                    {agent.agent_name.charAt(0).toUpperCase()}
                  </span>
                  {agent.agent_name}
                  <span className={cn("text-[11px] font-mono uppercase", isActive ? "opacity-80" : "text-muted-foreground")}>
                    {recent.mode}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(agents ?? []).length === 0 && !agentsLoading ? (
        <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          No agents exist yet.{" "}
          <Link href="/agents/new" className="underline underline-offset-2">
            Create one first
          </Link>
          .
        </div>
      ) : (
        <>
          {/* Two-step session setup */}
          <div className="grid md:grid-cols-2 gap-4 mb-8 lg:mb-5 shrink-0">
            <div className="rounded-[1.5rem] border border-border bg-card p-5 lg:p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
                <span className="text-ember-600 dark:text-ember-400 font-semibold">1 ·</span> Pick an agent
              </p>
              <div className="relative flex items-center gap-3">
                <span
                  className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#E73F1E] to-[#F9B637] text-white flex items-center justify-center text-lg font-semibold shrink-0"
                  aria-hidden="true"
                >
                  {(effectiveAgent?.agent_name ?? "?").charAt(0).toUpperCase()}
                </span>
                <select
                  value={effectiveAgentId}
                  onChange={(event) => selectAgent(event.target.value)}
                  disabled={agentsLoading}
                  aria-label="Agent to test with"
                  className="flex-1 min-w-0 h-12 appearance-none bg-transparent text-base font-medium text-foreground focus:outline-none disabled:opacity-50 cursor-pointer pr-8"
                >
                  {(agents ?? []).map((agent) => (
                    <option key={agent.agent_id} value={agent.agent_id}>
                      {agent.agent_name} · {agent.agent_type}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-1 pointer-events-none" />
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-border bg-card p-5 lg:p-4">
              <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3 lg:mb-2">
                <span className="text-ember-600 dark:text-ember-400 font-semibold">2 ·</span> Choose a mode
              </p>
              <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Playground mode">
                {(
                  [
                    { id: "talk", label: "Talk", hint: "Real mic conversation", icon: Mic, enabled: talkSupported },
                    { id: "chat", label: "Chat", hint: "Text conversation", icon: MessageSquareText, enabled: true },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.id}
                    onClick={() => option.enabled && selectMode(option.id)}
                    role="radio"
                    aria-checked={activeMode === option.id}
                    disabled={!option.enabled}
                    title={option.enabled ? option.hint : "Text agents have no audio pipeline"}
                    className={cn(
                      "flex items-center gap-3 px-4 h-14 rounded-2xl text-sm font-medium border transition-all text-left",
                      activeMode === option.id
                        ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                        : "bg-transparent text-muted-foreground border-border hover:text-foreground hover:bg-accent",
                      !option.enabled && "opacity-40 cursor-not-allowed"
                    )}
                  >
                    <option.icon className="w-4 h-4 shrink-0" />
                    <span>
                      <span className="block">{option.label}</span>
                      <span className={cn("block text-[11px] font-normal", activeMode === option.id ? "opacity-80" : "text-muted-foreground")}>
                        {option.hint}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {!talkSupported && (
            <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
              Text agents have no audio pipeline, so Talk is unavailable — chatting instead.
            </div>
          )}

          {activeMode === "talk" ? (
            <LiveTalk
              key={`talk-${effectiveAgentId}`}
              agentId={effectiveAgentId}
              agentName={effectiveAgent?.agent_name ?? "Agent"}
              canTalk={canLive}
            />
          ) : (
            effectiveAgentId && (
              <ChatTalk
                key={`chat-${effectiveAgentId}`}
                agentId={effectiveAgentId}
                agentName={effectiveAgent?.agent_name ?? "Agent"}
                canChat={canLive}
              />
            )
          )}
        </>
      )}
    </div>
  );
}
