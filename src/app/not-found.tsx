"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, AudioLines, Home, Radar } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const QUIPS = [
  "The frequency you're tuned to doesn't exist.",
  "This call dropped into the void. No transcript survived.",
  "We scanned every channel. Nothing but static here.",
  "The agent you dialed has left the matrix.",
];

const BARS = [38, 64, 92, 54, 78, 30, 86, 48, 70, 96, 42, 60, 82, 34, 74, 52, 88, 44];

function Equalizer() {
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
  const [quipIndex, setQuipIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setQuipIndex((index) => (index + 1) % QUIPS.length), 3200);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[80dvh] max-w-3xl mx-auto w-full px-4 text-center relative overflow-x-clip">
      {/* Local ambient glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(420px,90vw)] h-[min(420px,90vw)] bg-primary/10 blur-[130px] rounded-full pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex flex-col items-center"
      >
        <div className="flex items-center gap-2 mb-6">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          <p className="text-xs font-mono font-medium text-red-600 dark:text-red-400 tracking-[0.25em] uppercase">
            Error 404 // Signal lost
          </p>
        </div>

        <h1
          aria-label="404"
          className="text-[5rem] sm:text-[7rem] md:text-[9rem] font-semibold leading-none tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/80 to-primary/60 select-none"
        >
          404
        </h1>

        <div className="my-6 opacity-90">
          <Equalizer />
        </div>

        <div className="h-6 mb-8">
          <AnimatePresence mode="wait">
            <motion.p
              key={quipIndex}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.35 }}
              className="text-sm font-mono text-muted-foreground"
            >
              {QUIPS[quipIndex]}
            </motion.p>
          </AnimatePresence>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 mb-10">
          <Link
            href="/"
            className="h-12 px-7 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:bg-primary/90 transition-all flex items-center gap-2"
          >
            <Home className="w-4 h-4" />
            Command Center
          </Link>
          <button
            onClick={() => router.back()}
            className="h-12 px-7 rounded-2xl bg-card border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-all flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground mr-1">
            <Radar className="w-3.5 h-3.5" /> Retune to
          </span>
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex items-center gap-1.5 px-3.5 h-9 rounded-full text-xs border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-accent hover:border-primary/30 transition-all"
            >
              <AudioLines className="w-3 h-3" />
              {link.label}
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
