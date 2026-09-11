"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { GitFork, Workflow } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { RouteLoader } from "@/components/common/route-loader";
import { GraphsPanel } from "@/components/flows/graphs-panel";
import { WorkflowsPanel } from "@/components/flows/workflows-panel";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "graphs", label: "Graphs", icon: GitFork, href: "/flows" },
  { id: "workflows", label: "Workflows", icon: Workflow, href: "/flows?tab=workflows" },
] as const;

function FlowsContent() {
  // Pure derivation from the URL — no state, so no effect-to-state cascade.
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "workflows" ? "workflows" : "graphs";

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title="Flows"
        description="Conversation graphs and outreach workflows — design visually, test, deploy."
        className="mb-8"
      />

      <div className="flex flex-wrap items-center gap-2 mb-8" role="tablist" aria-label="Flow types">
        {TABS.map((option) => (
          <Link
            key={option.id}
            href={option.href}
            role="tab"
            aria-selected={tab === option.id}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-medium border transition-all",
              tab === option.id
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-accent"
            )}
          >
            <option.icon className="w-4 h-4" aria-hidden="true" />
            {option.label}
          </Link>
        ))}
      </div>

      {tab === "workflows" ? <WorkflowsPanel /> : <GraphsPanel />}
    </div>
  );
}

export default function FlowsPage() {
  return (
    <Suspense fallback={<RouteLoader label="Loading flows..." />}>
      <FlowsContent />
    </Suspense>
  );
}
