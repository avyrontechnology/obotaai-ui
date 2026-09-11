"use client";

import { GitFork, Workflow } from "lucide-react";
import Link from "next/link";

/**
 * Graph + workflow builder entry cards. Lives in OboFleet alongside agents
 * and templates — every build starting point in one workspace.
 */
export function BuildersPanel() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Link
        href="/flows?tab=graphs"
        className="group p-5 md:p-6 bg-card border border-border rounded-3xl transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
      >
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <GitFork className="w-5 h-5 text-ember-700 dark:text-ember-300" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1">Graphs</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Structured multi-step conversations with routers, static messages and version history. Dry-run, then
          deploy to the engine.
        </p>
        <span className="text-sm text-ember-700 dark:text-ember-300 group-hover:underline underline-offset-4">
          Open graph builder →
        </span>
      </Link>
      <Link
        href="/flows?tab=workflows"
        className="group p-5 md:p-6 bg-card border border-border rounded-3xl transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
      >
        <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
          <Workflow className="w-5 h-5 text-ember-700 dark:text-ember-300" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1">Workflows</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Chain calls, extractions, APIs, waits and retries. Test-run instantly, then launch CSV campaigns.
        </p>
        <span className="text-sm text-ember-700 dark:text-ember-300 group-hover:underline underline-offset-4">
          Open workflow builder →
        </span>
      </Link>
    </div>
  );
}
