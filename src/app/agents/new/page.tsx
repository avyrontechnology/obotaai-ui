import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AgentWizard } from "@/components/dashboard/agent-wizard";

export default function NewAgentPage() {
  return (
    <div className="flex flex-col flex-1 min-h-full max-w-5xl mx-auto w-full pt-12 pb-24 px-4 md:px-8">
      <Link
        href="/agents"
        className="flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors mb-6 w-fit"
      >
        <ArrowLeft className="w-4 h-4" /> Directory
      </Link>
      <div className="mb-4">
        <h1 className="text-3xl md:text-4xl font-medium text-foreground tracking-tight">
          Deploy Agent
        </h1>
        <p className="text-muted-foreground font-mono text-sm mt-1">
          Three steps → live in the directory. Fine-tune the pipeline afterwards in Configure.
        </p>
      </div>

      <AgentWizard />
    </div>
  );
}
