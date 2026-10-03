"use client";

import { OrgTools } from "@/components/settings/org-tools";
import { PageHeader } from "@/components/common/page-header";
import { useTools } from "@/services/platform/tools";

export default function ToolsPage() {
  // Header honesty: badge + status chips come from real hooks only.
  // Badge = useTools count; kinds + deprecated computed from real rows.
  // Everything shows "—" while loading.
  const { data: tools, isLoading } = useTools();

  const list = tools ?? [];
  const count = list.length;
  const functionCount = list.filter((tool) => tool.kind === "function").length;
  const webhookCount = list.filter((tool) => tool.kind === "webhook").length;
  const deprecatedCount = list.filter((tool) => tool.deprecated).length;

  const badge = isLoading ? "— tools" : `${count} tool${count === 1 ? "" : "s"}`;
  const badgeTitle = isLoading ? "Loading tools" : `${count} tools in registry`;

  const kindLabel = isLoading ? "—" : `${functionCount} function · ${webhookCount} webhook`;
  const kindTitle = isLoading
    ? "Loading tool kinds"
    : `${functionCount} function tools, ${webhookCount} webhook tools of ${count} total`;

  const statusLabel = isLoading ? "—" : deprecatedCount > 0 ? `${deprecatedCount} deprecated` : "all live";
  const statusTitle = isLoading
    ? "Loading tool status"
    : deprecatedCount > 0
      ? `${deprecatedCount} of ${count} tools flagged deprecated`
      : "No tools flagged deprecated";
  const statusDot = isLoading ? "bg-muted-foreground" : deprecatedCount > 0 ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title={
          <>
            <span className="truncate">Tools</span>
            <span
              className="font-mono text-xs font-normal tracking-normal px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground shrink-0 tabular-nums truncate max-w-full"
              title={badgeTitle}
            >
              {badge}
            </span>
          </>
        }
        description="Shared function and webhook tools agents attach by id. System rows are read-only."
        actions={
          <>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground font-mono text-xs uppercase tracking-widest shrink-0 max-w-full"
              title={kindTitle}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
              <span className="truncate tabular-nums">{kindLabel}</span>
            </span>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground font-mono text-xs uppercase tracking-widest shrink-0 max-w-full"
              title={statusTitle}
            >
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} aria-hidden="true" />
              <span className="truncate tabular-nums">{statusLabel}</span>
            </span>
          </>
        }
      />
      <OrgTools />
    </div>
  );
}
