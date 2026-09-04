"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}

export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:ring-offset-2 focus:ring-offset-background",
        checked ? "bg-primary shadow-[0_0_15px_rgba(251,108,0,0.4)]" : "bg-muted-foreground/30"
      )}
    >
      <motion.span
        layout
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
