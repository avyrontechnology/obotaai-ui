"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FLAT_NAV_ITEMS } from "./nav-items";
import { useAgents } from "@/services/api";
import { useBodyScrollLock } from "@/lib/use-body-scroll-lock";
import { cn } from "@/lib/utils";

interface PaletteEntry {
  key: string;
  group: string;
  label: string;
  hint?: string;
  href?: string;
  run?: () => void;
}

export function fuzzyScore(label: string, query: string): number {  const text = label.toLowerCase();
  const needle = query.toLowerCase().trim();
  if (!needle) return 1;
  if (text.startsWith(needle)) return 3;
  if (text.includes(needle)) return 2;
  let score = 0;
  let position = 0;
  for (const char of needle) {
    const found = text.indexOf(char, position);
    if (found === -1) return 0;
    score += 1;
    position = found + 1;
  }
  return score > 0 ? 1 : 0;
}

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { data: agents } = useAgents();
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [wasOpen, setWasOpen] = useState(open);
  const inputRef = useRef<HTMLInputElement>(null);
  useBodyScrollLock(open);

  // Reset on open without an effect (render-phase adjustment).
  if (open && !wasOpen) {
    setWasOpen(true);
    setQuery("");
    setCursor(0);
  }
  if (!open && wasOpen) {
    setWasOpen(false);
  }

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open ]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const pages: PaletteEntry[] = FLAT_NAV_ITEMS.map((item) => ({
      key: `page:${item.href}`,
      group: "Pages",
      label: item.label,
      href: item.href,
    }));
    const actions: PaletteEntry[] = [
      {
        key: "action:theme",
        group: "Actions",
        label: theme === "dark" ? "Switch to light mode" : "Switch to dark mode",
        run: () => setTheme(theme === "dark" ? "light" : "dark"),
      },
      { key: "action:agent", group: "Actions", label: "New agent", href: "/agents/new" },
      { key: "action:campaign", group: "Actions", label: "New campaign", href: "/batches" },
      { key: "action:topup", group: "Actions", label: "Top up credits", href: "/settings?tab=billing" },
    ];
    const recent: PaletteEntry[] = (agents ?? []).slice(0, 5).map((agent) => ({
      key: `agent:${agent.agent_id}`,
      group: "Recent agents",
      label: agent.agent_name,
      hint: agent.agent_type,
      href: `/agents/${agent.agent_id}`,
    }));
    return [...pages, ...actions, ...recent];
  }, [agents, theme, setTheme]);

  const results = useMemo(() => {
    const scored = entries
      .map((entry) => ({ entry, score: fuzzyScore(entry.label, query) }))
      .filter((item) => (query.trim() ? item.score > 0 : true));
    scored.sort((a, b) => b.score - a.score);
    return scored.map((item) => item.entry);
  }, [entries, query]);

  const choose = (entry: PaletteEntry) => {
    onClose();
    if (entry.run) entry.run();
    else if (entry.href) router.push(entry.href);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((value) => Math.min(value + 1, results.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((value) => Math.max(value - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const entry = results[cursor];
      if (entry) choose(entry);
    }
  };

  if (!open) return null;

  let lastGroup = "";
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Command palette">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="absolute left-1/2 top-[12vh] -translate-x-1/2 w-[calc(100vw-2rem)] max-w-xl">
        <div className="rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2.5 px-4 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCursor(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Jump to pages, agents, actions…"
              aria-label="Command palette search"
              role="combobox"
              aria-expanded="true"
              aria-controls="palette-results"
              aria-activedescendant={results[cursor] ? `palette-${results[cursor].key}` : undefined}
              className="w-full h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <kbd className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[10px] text-muted-foreground shrink-0">
              ESC
            </kbd>
          </div>
          <ul
            id="palette-results"
            role="listbox"
            aria-label="Results"
            className="max-h-[40vh] overflow-y-auto custom-scrollbar p-1.5"
          >
            {results.length === 0 && (
              <li className="px-3 py-8 text-center text-sm text-muted-foreground">No matches.</li>
            )}
            {results.map((entry, index) => {
              const header = entry.group !== lastGroup ? entry.group : null;
              lastGroup = entry.group;
              const active = index === cursor;
              return (
                <li key={entry.key}>
                  {header && (
                    <p className="px-2.5 pt-2 pb-1 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                      {header}
                    </p>
                  )}
                  <Link
                    href={entry.href ?? "#"}
                    id={`palette-${entry.key}`}
                    role="option"
                    aria-selected={active}
                    onClick={(event) => {
                      event.preventDefault();
                      choose(entry);
                    }}
                    onMouseMove={() => setCursor(index)}
                    className={cn(
                      "flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-sm transition-colors",
                      active ? "bg-accent text-accent-foreground" : "text-foreground"
                    )}
                  >
                    <span className="flex-1 truncate">{entry.label}</span>
                    {entry.hint && (
                      <span className="text-[11px] font-mono text-muted-foreground shrink-0">{entry.hint}</span>
                    )}
                    {active && <CornerDownLeft className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[11px] text-muted-foreground">
            <span>↑↓ navigate</span>
            <span>↵ select</span>
            <span className="ml-auto">esc close</span>
          </div>
        </div>
      </div>
    </div>
  );
}
