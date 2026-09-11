"use client";

import { memo, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { SearchInput } from "@/components/common/search-input";
import { fieldStyles } from "@/lib/field-styles";
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

const selectClass = fieldStyles.field;

interface CallsToolbarProps {
  search: string;
  onSearch: (value: string) => void;
  agentFilter: string;
  onAgentFilter: (value: string) => void;
  statusFilter: string;
  onStatusFilter: (value: string) => void;
  directionFilter: string;
  onDirectionFilter: (value: string) => void;
  onRefresh: () => void;
  agents: { agent_id: string; agent_name: string }[];
  isFetching?: boolean;
}

export const CallsToolbar = memo(function CallsToolbar({
  search,
  onSearch,
  agentFilter,
  onAgentFilter,
  statusFilter,
  onStatusFilter,
  directionFilter,
  onDirectionFilter,
  onRefresh,
  agents,
  isFetching,
}: CallsToolbarProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [stuck, setStuck] = useState(false);
  // Local input state — commits to the URL debounced so every keystroke
  // doesn't trigger a navigation + full list re-render.
  const [draft, setDraft] = useState(search);
  useEffect(() => {
    setDraft(search);
  }, [search]);
  useEffect(() => {
    if (draft === search) return;
    const timer = setTimeout(() => onSearch(draft), 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft]);
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
        className="sticky top-0 z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-3 mb-4 bg-background border-b border-transparent data-[stuck=true]:border-border transition-colors flex flex-col sm:flex-row sm:items-center flex-wrap gap-3"
      >
        <div className="flex-1 min-w-[200px] flex items-center gap-2">
          <SearchInput
            value={draft}
            onChange={setDraft}
            placeholder="Filter this page by number, execution or agent…"
            title="Page filter — narrows the 25 loaded rows. Use agent/status filters for full history."
            label="Filter current page"
            className="!w-full max-w-none lg:max-w-xs"
          />
          {isFetching && (
            <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-ember-500 animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              Live
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <select
            value={agentFilter}
            onChange={(event) => onAgentFilter(event.target.value)}
            aria-label="Filter by agent"
            className={cn(selectClass, "min-w-0 flex-1 sm:flex-none sm:w-auto sm:min-w-[140px] truncate")}
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
            className={cn(selectClass, "min-w-0 flex-1 sm:flex-none sm:w-auto sm:min-w-[140px] truncate")}
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
          <select
            value={directionFilter}
            onChange={(event) => onDirectionFilter(event.target.value)}
            aria-label="Filter by direction"
            title="Page filter — narrows the loaded rows. The executions API has no direction parameter."
            className={cn(selectClass, "min-w-0 flex-1 sm:flex-none sm:w-auto sm:min-w-[140px] truncate")}
          >
            <option value="all">All directions</option>
            <option value="inbound">Inbound</option>
            <option value="outbound">Outbound</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh call history"
            title="Refresh call history"
            className="inline-flex items-center justify-center h-11 w-11 rounded-2xl bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors shrink-0"
          >
            <RefreshCw
              className={cn("w-4 h-4", isFetching && "animate-spin motion-reduce:animate-none")}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
    </>
  );
});
