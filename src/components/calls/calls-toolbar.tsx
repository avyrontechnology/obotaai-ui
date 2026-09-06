"use client";

import { useEffect, useRef, useState } from "react";
import { SearchInput } from "@/components/common/search-input";
import { cn } from "@/lib/utils";

const STATUS_GROUPS = [
  {
    label: "Active",
    options: [
      { value: "queued", label: "Queued" },
      { value: "ringing", label: "Ringing" },
      { value: "in_progress", label: "In progress" },
    ],
  },
  {
    label: "Terminal",
    options: [
      { value: "completed", label: "Completed" },
      { value: "failed", label: "Failed" },
      { value: "no-answer", label: "No answer" },
      { value: "busy", label: "Busy" },
      { value: "canceled", label: "Canceled" },
    ],
  },
] as const;

const selectClass =
  "h-11 px-4 bg-card border border-border rounded-2xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 transition-all";

interface CallsToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  agentFilter: string;
  onAgentFilter: (value: string) => void;
  statusFilter: string;
  onStatusFilter: (value: string) => void;
  agents: { agent_id: string; agent_name: string }[];
  isFetching?: boolean;
}

export function CallsToolbar({
  search,
  onSearch,
  agentFilter,
  onAgentFilter,
  statusFilter,
  onStatusFilter,
  agents,
  isFetching,
}: CallsToolbarProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry.isIntersecting),
      { threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px -mt-px" />
      <div
        data-stuck={stuck}
        className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-4 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-transparent data-[stuck=true]:border-border flex flex-col sm:flex-row gap-3"
      >
      <div className="flex-1 min-w-0 flex items-center gap-2">
        <SearchInput
          value={search}
          onChange={onSearch}
          placeholder="Search number, execution or agent..."
          label="Search calls"
          className="!w-full max-w-xs"
        />
        {isFetching && (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-ember-500 animate-pulse" />
            Live
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <select
          value={agentFilter}
          onChange={(event) => onAgentFilter(event.target.value)}
          aria-label="Filter by agent"
          className={cn(selectClass, "min-w-[160px]")}
          suppressHydrationWarning
        >
          <option value="all">All agents</option>
          {agents.map((agent) => (
            <option key={agent.agent_id} value={agent.agent_id}>
              {agent.agent_name}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => onStatusFilter(event.target.value)}
          aria-label="Filter by status"
          className={cn(selectClass, "min-w-[160px]")}
        >
          <option value="all">All statuses</option>
          {STATUS_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      </div>
    </>
  );
}
