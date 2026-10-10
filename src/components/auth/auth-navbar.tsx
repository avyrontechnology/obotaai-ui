"use client";

import { useState } from "react";
import { useEngineHealth } from "@/services/health";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/common/brand-lockup";
import {
  ComingSoonDialog,
  LegalDialog,
  type ComingSoonTopic,
  type LegalDoc,
} from "@/components/auth/info-dialogs";

/** Opens the centered, interactive "coming soon" dialog for `topic`. */
export function SoonLink({
  children,
  topic,
  className,
}: {
  children: React.ReactNode;
  topic: ComingSoonTopic;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn("hover:text-[#1F2937] transition-colors", className)}
      >
        {children}
      </button>
      <ComingSoonDialog topic={open ? topic : null} onClose={() => setOpen(false)} />
    </>
  );
}

/** Live engine status: green when the backend answers (any HTTP status counts),
 *  with the measured round-trip latency like the mockup's "(18ms)". */
export function EngineStatus({ withLatency = false }: { withLatency?: boolean }) {
  const health = useEngineHealth();
  const state = health.isPending ? "checking" : health.isSuccess ? "live" : "down";
  const latency = health.data?.latencyMs ?? null;

  return (
    <span className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white border border-[#CDEEDB] text-[13px] font-medium text-[#1F2937] shadow-sm">
      <span className="relative flex h-2.5 w-2.5">
        {state === "live" && (
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
        )}
        <span
          className={cn(
            "relative inline-flex rounded-full h-2.5 w-2.5",
            state === "live" && "bg-emerald-500",
            state === "checking" && "bg-amber-400 animate-pulse",
            state === "down" && "bg-stone-300"
          )}
        />
      </span>
      <span className="font-mono">
        {state === "live" && (
          <>
            All Voice Engines Operational{withLatency && latency !== null && ` (${latency}ms)`}
          </>
        )}
        {state === "checking" && "Checking voice engines…"}
        {state === "down" && "Voice Engines Unreachable"}
      </span>
    </span>
  );
}

export function AuthNavbar({ right }: { right?: React.ReactNode }) {
  return (
    <header className="bg-[#FFF6E8]/80 backdrop-blur-xl border-b border-[#F3E3C3]/80 sticky top-0 z-40">
      <div className="px-6 md:px-12 h-16 flex items-center justify-between gap-6 shrink-0">
        <BrandLockup size="md" tone="light" />
        <nav className="hidden lg:flex items-center gap-7 text-[15px] text-[#374151]" aria-label="Top">
          <EngineStatus withLatency />
          <SoonLink topic="docs">Documentation</SoonLink>
          <SoonLink topic="support">Enterprise Support</SoonLink>
          {right}
        </nav>
        <span className="lg:hidden">
          <EngineStatus />
        </span>
      </div>
    </header>
  );
}

const LEGAL_LINKS: { doc: LegalDoc; label: string }[] = [
  { doc: "privacy", label: "Privacy Policy" },
  { doc: "terms", label: "Terms of Service" },
  { doc: "security", label: "Security Architecture" },
];

export function AuthFooter() {
  const [legalDoc, setLegalDoc] = useState<LegalDoc | null>(null);
  return (
    <footer className="bg-[#FFF6E8]/80 backdrop-blur-xl border-t border-[#F3E3C3]/80 shrink-0">
      <div className="px-6 md:px-12 py-3 flex flex-col md:flex-row items-center justify-between gap-2 text-[12px] text-[#6B7280] w-full">
        <p>
          <span className="font-semibold text-[#1F2937]">OtobaAI Platform Inc.</span> © 2026. All rights
          reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
          {LEGAL_LINKS.map((link) => (
            <button
              key={link.doc}
              type="button"
              onClick={() => setLegalDoc(link.doc)}
              className="hover:text-[#1F2937] hover:underline underline-offset-4 transition-colors"
            >
              {link.label}
            </button>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            System Status
          </span>
        </nav>
      </div>
      <LegalDialog doc={legalDoc} onChange={setLegalDoc} onClose={() => setLegalDoc(null)} />
    </footer>
  );
}
