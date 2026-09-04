"use client";

import { motion } from "framer-motion";
import { memo, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string;
  icon?: ReactNode;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  delay?: number;
  className?: string;
}

export const StatCard = memo(function StatCard({ title, value, icon, trend, delay = 0, className }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.5, 
        ease: [0.23, 1, 0.32, 1],
        delay 
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl border border-border bg-card p-6 backdrop-blur-xl",
        "hover:bg-accent transition-colors duration-300",
        "group",
        className
      )}
    >
      {/* Decorative gradient orb */}
      <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-ember-400/10 blur-3xl transition-transform duration-500 group-hover:scale-150" />

      <div className="relative z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-sm font-medium tracking-wide">{title}</span>
          {icon && (
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
              {icon}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-4xl font-semibold tracking-tight text-foreground">
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                "text-xs font-medium px-2 py-0.5 rounded-full",
                trend.isPositive
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
              )}
            >
              {trend.isPositive ? "+" : "-"}{trend.value}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
});
