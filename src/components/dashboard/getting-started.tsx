"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Bot, Check, ChevronRight, Megaphone, PhoneCall } from "lucide-react";
import { useAgents } from "@/services/api";
import { useBatches } from "@/services/platform/batches";
import { useExecutions } from "@/services/platform/executions";
import { cn } from "@/lib/utils";

export function GettingStarted() {
  const { data: agents } = useAgents();
  const { data: executions } = useExecutions();
  const { data: batches } = useBatches();

  const steps = [
    {
      done: (agents ?? []).length > 0,
      icon: Bot,
      title: "Create your first agent",
      description: "Design a voice agent for your use case.",
      href: "/agents/new",
      cta: "Build agent",
    },
    {
      done: (executions ?? []).length > 0,
      icon: PhoneCall,
      title: "Place a test call",
      description: "Try it in the Studio before going live.",
      href: "/playground",
      cta: "Open Studio",
    },
    {
      done: (batches ?? []).length > 0,
      icon: Megaphone,
      title: "Launch a campaign",
      description: "Upload a list and start bulk calling.",
      href: "/batches",
      cta: "New campaign",
    },
  ];

  if (steps.every((step) => step.done)) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      aria-label="Getting started"
      className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-6 md:p-8"
    >
      <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-primary/10 blur-[80px] pointer-events-none" />
      <div className="relative z-10">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Getting started</h2>
        <p className="text-sm text-muted-foreground mt-1 mb-6">
          Three steps from signup to live calls.
        </p>
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className={cn(
                "flex items-start gap-3 rounded-2xl border p-4 transition-colors",
                step.done ? "border-emerald-500/20 bg-emerald-500/5" : "border-border bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-xl shrink-0 font-mono text-xs font-semibold",
                  step.done ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-muted text-muted-foreground"
                )}
                aria-label={step.done ? `Step ${index + 1} complete` : `Step ${index + 1}`}
              >
                {step.done ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">
                  {index + 1}. {step.title}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5 mb-2">{step.description}</span>
                {!step.done && (
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 text-xs font-medium text-ember-700 dark:text-ember-300 hover:underline underline-offset-4"
                  >
                    {step.cta} <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </motion.section>
  );
}
