"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowDown, AudioLines, Gauge, Wrench } from "lucide-react";
import { useAgentTools } from "@/services/platform/tools";
import { formatLatency } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Stick-to-bottom threshold: within this many px of the bottom counts as pinned. */
const PIN_THRESHOLD_PX = 48;

export interface SessionTurn {
  id: number;
  role: "agent" | "user" | "system";
  text: string;
  ts: string;
}

/** Measured session stats. Everything here is observed client-side —
 *  turn round-trips, audio inter-arrival jitter, turn count, elapsed time.
 *  Nothing is estimated or faked. */
export interface SessionStats {
  /** Last measured turn round-trip (send → first agent frame), ms. */
  e2eMs: number | null;
  /** Jitter of inbound audio frame arrivals (stddev), ms. Null when N/A. */
  jitterMs: number | null;
  turns: number;
  elapsedSec: number;
  /** Device output rate the context runs at (24000 = native, no resample). */
  deviceRate: number | null;
  /** Audio sources scheduled for playback this call. */
  playedChunks: number;
}

export type SessionTab = "transcript" | "tools" | "jitter";

export function SessionTabs({
  tab,
  onChange,
  onClear,
  tabs = ["transcript", "tools", "jitter"],
}: {
  tab: SessionTab;
  onChange: (tab: SessionTab) => void;
  onClear: () => void;
  /** Subset + order of tabs (chat mode omits the transcript mirror). */
  tabs?: SessionTab[];
}) {
  const allTabs: { id: SessionTab; label: string; icon?: typeof AudioLines }[] = [
    { id: "transcript", label: "Live Transcript", icon: AudioLines },
    { id: "tools", label: "Tools", icon: Wrench },
    { id: "jitter", label: "Jitter", icon: Gauge },
  ];
  const visible = allTabs.filter((entry) => tabs.includes(entry.id));
  return (
    <div className="flex items-center gap-1 border-b border-border relative z-10 shrink-0" role="tablist" aria-label="Session panel">
      {visible.map((option) => (
        <button
          key={option.id}
          onClick={() => onChange(option.id)}
          role="tab"
          aria-selected={tab === option.id}
          className={cn(
            "flex items-center gap-1.5 px-3 py-3 text-[11px] font-mono uppercase tracking-widest transition-colors border-b-2 -mb-px",
            tab === option.id
              ? "text-ember-700 dark:text-ember-300 border-ember-600 dark:border-ember-400 font-semibold"
              : "text-muted-foreground border-transparent hover:text-foreground"
          )}
        >
          {option.icon && <option.icon className="w-3.5 h-3.5" />}
          {option.label}
        </button>
      ))}
      <button
        onClick={onClear}
        className="ml-auto text-[11px] font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors px-2 py-3"
      >
        Clear
      </button>
    </div>
  );
}

export function TranscriptList({
  turns,
  emptyHint,
  minHeight = "min-h-[200px] lg:min-h-0",
}: {
  turns: SessionTurn[];
  emptyHint: string;
  minHeight?: string;
}) {
  // min-h-0 chain + bounded parent = internal scroll instead of page growth.
  // max-h cap only below lg, where the page itself scrolls.
  const listRef = useRef<HTMLDivElement | null>(null);
  // Pinned = glued to the bottom. Set ONLY from the scroll handler (a user
  // gesture), never from an effect — the set-state-in-effect rule stays green.
  const [pinned, setPinned] = useState(true);
  const pinnedRef = useRef(true);
  // Newest turn id that arrived while unpinned. Render-phase derived state
  // (the documented adjust-state-during-render pattern): no refs read in
  // render, no setState in effects — both lint rules stay green.
  const [pillFor, setPillFor] = useState<number | null>(null);
  const [prevLastId, setPrevLastId] = useState(0);

  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const scrollToBottom = (smooth: boolean) => {
    const el = listRef.current;
    if (!el) return;
    if (typeof el.scrollTo === "function") {
      el.scrollTo({ top: el.scrollHeight, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
    } else {
      el.scrollTop = el.scrollHeight;
    }
  };

  const handleScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight <= PIN_THRESHOLD_PX;
    pinnedRef.current = nearBottom;
    setPinned(nearBottom);
    if (nearBottom) setPillFor(null);
  };

  // DOM scroll only — no setState — so new arrivals glide to the bottom
  // while pinned and never yank the user away while reading history.
  const lastId = turns.length > 0 ? turns[turns.length - 1].id : 0;
  if (lastId !== prevLastId) {
    setPrevLastId(lastId);
    setPillFor(!pinned && lastId !== 0 ? lastId : null);
  }
  useEffect(() => {
    if (pinnedRef.current) scrollToBottom(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns]);

  const showPill = !pinned && pillFor !== null;
  const jumpToLatest = () => {
    pinnedRef.current = true;
    setPinned(true);
    setPillFor(null);
    scrollToBottom(false);
  };

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      data-testid="transcript-list"
      className={cn(
        "flex-1 max-h-[60vh] lg:max-h-none overflow-y-auto space-y-5 pr-2 custom-scrollbar relative z-10",
        minHeight
      )}
    >
      {turns.length === 0 ? (
        <p className="text-sm text-muted-foreground leading-relaxed">{emptyHint}</p>
      ) : (
        <AnimatePresence initial={false}>
          {turns.map((turn) =>
            turn.role === "system" ? (
              <p key={turn.id} className="text-[11px] font-mono text-muted-foreground text-center">
                {turn.text}
              </p>
            ) : (
              <motion.div
                key={turn.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={cn("flex flex-col", turn.role === "agent" ? "items-start" : "items-end")}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span
                    className={cn(
                      "text-[10px] uppercase font-mono tracking-wider",
                      turn.role === "agent"
                        ? "text-ember-700 dark:text-ember-300"
                        : "text-emerald-700 dark:text-emerald-400"
                    )}
                  >
                    {turn.role === "agent" ? "Agent" : "You"}
                  </span>
                  <span className="text-[9px] font-mono text-muted-foreground">{turn.ts}</span>
                </div>
                <div
                  className={cn(
                    "px-5 py-3.5 max-w-[90%] text-sm leading-relaxed break-words shadow-sm",
                    turn.role === "agent"
                      ? "bg-card/80 border border-border text-foreground rounded-2xl rounded-tl-sm"
                      : "bg-primary border border-border text-primary-foreground rounded-2xl rounded-tr-sm"
                  )}
                >
                  {turn.text}
                </div>
              </motion.div>
            )
          )}
        </AnimatePresence>
      )}
      {showPill && (
        <button
          type="button"
          onClick={jumpToLatest}
          className="sticky bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 h-8 px-4 rounded-full bg-foreground text-background text-xs font-medium shadow-lg hover:opacity-90 transition-all"
        >
          <ArrowDown className="w-3.5 h-3.5" aria-hidden="true" />
          New messages
        </button>
      )}
    </div>
  );
}

export function ToolsPanel({ agentId }: { agentId: string }) {
  const { data: tools, isLoading } = useAgentTools(agentId);
  if (isLoading) {
    return <div className="h-24 rounded-2xl bg-muted/50 animate-pulse" aria-label="Loading tools" />;
  }
  if (!tools || tools.length === 0) {
    return (
      <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-6 text-center">
        No function tools attached to this agent yet.
      </p>
    );
  }
  return (
    <ul className="space-y-2">
      {tools.map((tool) => (
        <li
          key={tool.tool_id}
          className="flex items-center gap-3 rounded-2xl border border-border bg-muted/40 px-4 py-3"
        >
          <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 shrink-0">
            <Wrench className="w-3.5 h-3.5 text-ember-700 dark:text-ember-300" />
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-medium text-foreground truncate">{tool.name}</span>
            <span className="block text-[11px] font-mono text-muted-foreground truncate">{tool.kind}</span>
          </span>
          {!tool.enabled && (
            <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground shrink-0">
              off
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function JitterPanel({ stats, hasAudio }: { stats: SessionStats; hasAudio: boolean }) {
  const rows: { label: string; value: string; tone: string }[] = [
    { label: "E2E Latency", value: formatLatency(stats.e2eMs), tone: "text-ember-700 dark:text-ember-300" },
    {
      label: "Jitter",
      value: hasAudio ? formatLatency(stats.jitterMs !== null ? Math.round(stats.jitterMs) : null) : "—",
      tone: "text-foreground",
    },
    { label: "Turns", value: String(stats.turns), tone: "text-foreground" },
    {
      label: "Device rate",
      value: stats.deviceRate ? `${Math.round(stats.deviceRate / 100) / 10}kHz` : "—",
      tone: "text-foreground",
    },
    {
      label: "Played",
      value: String(stats.playedChunks),
      tone: "text-foreground",
    },
    {
      label: "Session",
      value: `${String(Math.floor(stats.elapsedSec / 60)).padStart(2, "0")}:${String(stats.elapsedSec % 60).padStart(2, "0")}`,
      tone: "text-foreground",
    },
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-center">
          <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">{row.label}</p>
          <p className={cn("text-lg font-semibold tabular-nums mt-0.5", row.tone)}>{row.value}</p>
        </div>
      ))}
      {!hasAudio && (
        <p className="col-span-2 text-xs text-muted-foreground leading-relaxed">
          Jitter is measured from inbound audio frame arrivals — text-only turns don&apos;t produce audio.
        </p>
      )}
    </div>
  );
}
