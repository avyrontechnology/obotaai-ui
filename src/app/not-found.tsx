"use client";

import { useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, AudioLines, Home, Radar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Single static quip (no auto-rotation): rotating aria-live text every few
// seconds is a screen-reader annoyance, and interval-driven setState in an
// effect violates the no-setState-in-effect rule. Keep the list for copy.
const QUIPS = [
  "The frequency you're tuned to doesn't exist.",
  "This call dropped into the void. No transcript survived.",
  "We scanned every channel. Nothing but static here.",
  "The agent you dialed has left the matrix.",
];

const BARS = [38, 64, 92, 54, 78, 30, 86, 48, 70, 96, 42, 60, 82, 34, 74, 52, 88, 44];

function Equalizer({ reducedMotion }: { reducedMotion: boolean }) {
  if (reducedMotion) {
    return (
      <div className="flex items-end justify-center gap-1.5 h-24" aria-hidden="true">
        {BARS.map((height, index) => (
          <span
            key={index}
            style={{ height: Math.max(6, height * 0.5) }}
            className="w-1.5 rounded-full bg-gradient-to-t from-ember-700/70 to-primary dark:from-ember-400/60 dark:to-ember-300/90"
          />
        ))}
      </div>
    );
  }
  return (
    <div className="flex items-end justify-center gap-1.5 h-24" aria-hidden="true">
      {BARS.map((height, index) => (
        <motion.span
          key={index}
          className="w-1.5 rounded-full bg-gradient-to-t from-ember-700/70 to-primary dark:from-ember-400/60 dark:to-ember-300/90"
          initial={{ height: 6 }}
          animate={{ height: [6, height, height * 0.35, height, 6] }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            delay: index * 0.09,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

const QUICK_LINKS = [
  { label: "Dashboard", href: "/" },
  { label: "OboFleet", href: "/agents" },
  { label: "Call History", href: "/calls" },
  { label: "Knowledge Base", href: "/library" },
  { label: "Flows", href: "/flows" },
  { label: "Playground", href: "/playground" },
];

export default function NotFound() {
  const router = useRouter();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const reduceMotion = useReducedMotion();

  // Focus-only effect (no setState): moves screen-reader + keyboard focus to
  // the heading on mount. scroll-mt-20 keeps it clear of the sticky top bar.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80dvh] max-w-3xl mx-auto w-full px-4 text-center relative overflow-x-clip">
      {/* Local ambient glow */}
      <div
        aria-hidden="true"
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(420px,90vw)] h-[min(420px,90vw)] bg-primary/10 blur-[130px] rounded-full pointer-events-none"
      />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="flex items-center gap-2 mb-6">
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive/60 motion-reduce:animate-none" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-destructive" />
          </span>
          <p className="text-xs font-mono font-medium text-destructive tracking-[0.25em] uppercase">
            Error 404 // Signal lost
          </p>
        </div>

        <h1
          ref={headingRef}
          tabIndex={-1}
          aria-label="404 — Page not found"
          className="text-[5rem] sm:text-[7rem] md:text-[9rem] font-semibold leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/80 to-primary/60 select-none scroll-mt-20 outline-none"
        >
          404
        </h1>

        <div className="my-6 opacity-90">
          <Equalizer reducedMotion={reduceMotion ?? false} />
        </div>

        <div className="min-h-6 mb-8" role="status" aria-live="polite">
          <p className="text-sm font-mono text-muted-foreground">{QUIPS[0]}</p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-10">
          <Link
            href="/"
            className="h-12 px-7 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:bg-primary/90 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background flex items-center gap-2"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            Command Center
          </Link>
          <button
            type="button"
            onClick={() => router.back()}
            className="h-12 px-7 rounded-2xl bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            Go back
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground mr-1">
            <Radar className="w-3.5 h-3.5" aria-hidden="true" /> Retune to
          </span>
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent hover:border-primary/30 transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <AudioLines className="w-3 h-3" aria-hidden="true" />
              {link.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
