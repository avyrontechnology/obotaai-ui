"use client";

import { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, description, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8", className)}>
      <div className="flex flex-col gap-1.5">
        <motion.h2 
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="text-2xl font-semibold tracking-tight text-foreground"
        >
          {title}
        </motion.h2>
        {description && (
          <motion.p 
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: 0.05 }}
            className="text-sm text-muted-foreground max-w-2xl"
          >
            {description}
          </motion.p>
        )}
      </div>
      {action && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut", delay: 0.1 }}
        >
          {action}
        </motion.div>
      )}
    </div>
  );
}
