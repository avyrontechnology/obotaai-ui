"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Database, GitFork, LayoutTemplate, Workflow } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KbManager } from "@/components/library/kb-manager";
import { PageHeader } from "@/components/common/page-header";
import { ErrorState } from "@/components/common/error-state";
import { TemplateCard } from "@/components/library/template-card";
import { useCreateAgent } from "@/services/api";
import { templatePayloadToAgentData } from "@/services/api-transforms";
import { useImportTemplate, useTemplates } from "@/services/platform/templates";
import type { TemplateSummary } from "@/lib/schemas/platform";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

type Tab = "templates" | "knowledge" | "builders";

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>("templates");
  const [industry, setIndustry] = useState("All");
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const router = useRouter();
  const { data: templates, isLoading, error, refetch } = useTemplates();
  const importTemplate = useImportTemplate();
  const createAgent = useCreateAgent();

  const industries = useMemo(() => {
    const unique = new Set((templates ?? []).map((template) => template.industry));
    return ["All", ...Array.from(unique).sort()];
  }, [templates]);

  const visible = useMemo(
    () => (templates ?? []).filter((template) => industry === "All" || template.industry === industry),
    [templates, industry]
  );

  const handleImport = async (template: TemplateSummary) => {
    setImportError(null);
    setImportingId(template.template_id);
    try {
      const payload = await importTemplate.mutateAsync(template.template_id);
      const data = templatePayloadToAgentData(payload as Record<string, unknown>);
      const created = await createAgent.mutateAsync(data);
      notify.success("Template imported", { description: `${template.name} is ready to configure` });
      router.push(`/agents/${created.agent_id}/configure`);
    } catch {
      setImportError(`Could not import ${template.name}. Check the backend and retry.`);
      setImportingId(null);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-12 pb-32 px-4 md:px-8">
      <PageHeader
        title="Agent"
        accent="Library"
        description="Production-ready templates and shared knowledge — import, attach, deploy."
        className="mb-8"
      />

      <div className="flex flex-wrap items-center gap-2 mb-8" role="tablist" aria-label="Library sections">
        {(
          [
            { id: "templates", label: "Templates", icon: LayoutTemplate },
            { id: "knowledge", label: "Knowledge Bases", icon: Database },
            { id: "builders", label: "Builders", icon: Workflow },
          ] as const
        ).map((option) => (
          <button
            key={option.id}
            onClick={() => setTab(option.id)}
            role="tab"
            aria-selected={tab === option.id}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-medium border transition-all",
              tab === option.id
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-accent"
            )}
          >
            <option.icon className="w-4 h-4" />
            {option.label}
          </button>
        ))}
      </div>

      {tab === "knowledge" ? (
        <KbManager />
      ) : tab === "builders" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/graphs"
            className="group p-6 bg-card border border-border rounded-[2rem] transition-colors hover:bg-muted/40"
          >
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <GitFork className="w-5 h-5 text-ember-700 dark:text-ember-300" />
            </div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground mb-1">Graph Agents</h3>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Structured multi-step conversations with routers, static messages and version history. Dry-run, then
              deploy to the engine.
            </p>
            <span className="text-sm text-ember-700 dark:text-ember-300 group-hover:underline underline-offset-4">
              Open graph builder →
            </span>
          </Link>
          <Link
            href="/workflows"
            className="group p-6 bg-card border border-border rounded-[2rem] transition-colors hover:bg-muted/40"
          >
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
              <Workflow className="w-5 h-5 text-ember-700 dark:text-ember-300" />
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
      ) : (
        <>
          {importError && (
            <p className="mb-6 flex items-center gap-2 text-sm text-red-700 dark:text-red-400 rounded-2xl border border-red-500/20 bg-red-500/5 px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" /> {importError}
            </p>
          )}

          <div className="flex flex-wrap gap-2 mb-6">
            {industries.map((option) => (
              <button
                key={option}
                onClick={() => setIndustry(option)}
                className={cn(
                  "px-4 h-9 rounded-full text-xs font-mono border transition-colors",
                  industry === option
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                {option}
              </button>
            ))}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div key={index} className="h-64 rounded-[2rem] bg-card border border-border animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <ErrorState message="Failed to load templates. Is the backend running?" onRetry={() => refetch()} />
          ) : visible.length === 0 ? (
            <p className="text-sm text-muted-foreground rounded-[2rem] border border-dashed border-border p-10 text-center">
              No templates in this industry yet.
            </p>
          ) : (
            <motion.div layout className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visible.map((template) => (
                <TemplateCard
                  key={template.template_id}
                  template={template}
                  importing={importingId === template.template_id}
                  onImport={handleImport}
                />
              ))}
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
