"use client";

import { memo } from "react";
import { motion } from "framer-motion";
import { Download, Languages, Loader2 } from "lucide-react";
import type { TemplateSummary } from "@/lib/schemas/platform";

interface TemplateCardProps {
  template: TemplateSummary;
  importing: boolean;
  onImport: (template: TemplateSummary) => void;
}

export const TemplateCard = memo(function TemplateCard({ template, importing, onImport }: TemplateCardProps) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative flex flex-col p-6 bg-card border border-border rounded-[2rem] overflow-hidden transition-colors hover:bg-muted/40"
    >
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 blur-[60px] rounded-full pointer-events-none" />

      <div className="relative z-10 flex items-center gap-2 mb-3">
        <span className="px-2.5 py-1 rounded-full text-[11px] font-mono uppercase tracking-wider bg-primary/10 text-ember-700 dark:text-ember-300 border border-primary/20">
          {template.industry}
        </span>
        {template.languages.length > 0 && (
          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-muted-foreground">
            <Languages className="w-3.5 h-3.5" />
            {template.languages.join(" · ")}
          </span>
        )}
      </div>

      <h3 className="relative z-10 text-lg font-semibold tracking-tight text-foreground mb-2">
        {template.name}
      </h3>
      <p className="relative z-10 text-sm text-muted-foreground leading-relaxed mb-6 flex-1">
        {template.description}
      </p>

      <button
        onClick={() => onImport(template)}
        disabled={importing}
        className="relative z-10 h-11 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
      >
        {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        {importing ? "Importing…" : "Import Agent"}
      </button>
    </motion.div>
  );
});
