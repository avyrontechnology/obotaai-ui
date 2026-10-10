"use client";

import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";

/**
 * One-time secret reveal. The plaintext lives only here and dies
 * with the dialog — list views only ever carry metadata.
 */
export function SecretOnceBox({
  title,
  secret,
  onCopy,
  copied,
  onDone,
}: {
  title: string;
  secret: string;
  onCopy: () => void;
  copied: boolean;
  onDone: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 space-y-3 min-w-0 motion-reduce:transition-none"
    >
      <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300" title={title}>
        {title}
      </p>
      <div className="flex gap-2 min-w-0">
        <code
          className="flex-1 min-w-0 truncate h-11 px-4 flex items-center bg-card border border-border rounded-2xl font-mono text-xs text-foreground"
          title={secret}
        >
          {secret}
        </code>
        <button
          onClick={onCopy}
          aria-label="Copy one-time secret"
          title="Copy one-time secret"
          className="h-11 w-11 shrink-0 flex items-center justify-center rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 motion-reduce:transition-none"
        >
          {copied ? <Check className="w-4 h-4" aria-hidden="true" /> : <Copy className="w-4 h-4" aria-hidden="true" />}
        </button>
        <button
          onClick={onDone}
          className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          Done
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground">Copy it now — it will never show again.</p>
    </motion.div>
  );
}
