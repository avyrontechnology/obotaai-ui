import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentWizard } from "@/components/dashboard/agent-wizard";

export default function NewAgentPage() {
  return (
    <div className="flex flex-col flex-1 min-h-full max-w-5xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <Link
        href="/agents"
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors duration-200 mb-6 w-fit rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" /> OboFleet directory
      </Link>
      <div className="mb-4">
        <p className="text-[11px] font-mono uppercase tracking-widest text-ember-700 dark:text-ember-300 mb-2">
          OboFleet · New deployment
        </p>
        <h1 className="text-2xl md:text-3xl font-medium text-foreground tracking-tight">
          Deploy Agent
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">
          Three steps → live in the fleet. Fine-tune the pipeline afterwards in Configure.
        </p>
      </div>

      <AgentWizard />
    </div>
  );
}
