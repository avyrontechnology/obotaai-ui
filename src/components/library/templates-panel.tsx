"use client";

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { TemplateCard } from "@/components/library/template-card";
import { ErrorState } from "@/components/common/error-state";
import { useCreateAgent } from "@/services/api";
import { templatePayloadToAgentData } from "@/services/api-transforms";
import { useImportTemplate, useTemplates } from "@/services/platform/templates";
import type { TemplateSummary } from "@/lib/schemas/platform";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

/**
 * Production-ready agent templates. Lives in OboFleet (not Knowledge Base) so
 * templates sit next to the fleet they deploy into — Knowledge Base is reserved
 * for shared knowledge bases and builders.
 */
export function TemplatesPanel() {
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
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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
  );
}
