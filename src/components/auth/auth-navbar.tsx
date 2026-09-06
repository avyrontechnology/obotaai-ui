"use client";

import { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api-client";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { BrandLockup } from "@/components/common/brand-lockup";

export function SoonLink({ children, note }: { children: React.ReactNode; note: string }) {
  return (
    <button
      type="button"
      onClick={() => notify.info("Coming soon", { description: note })}
      className="hover:text-[#1F2937] transition-colors"
    >
      {children}
    </button>
  );
}

/** Live engine status: green when the backend answers (any HTTP status counts),
 *  with the measured round-trip latency like the mockup's "(18ms)". */
export function EngineStatus({ withLatency = false }: { withLatency?: boolean }) {
  const [state, setState] = useState<"checking" | "live" | "down">("checking");
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const started = performance.now();
    fetch(`${API_BASE_URL}/auth/me`, { credentials: "include", signal: controller.signal })
      .then(() => {
        if (!cancelled) {
          setLatency(Math.max(1, Math.round(performance.now() - started)));
          setState("live");
        }
      })
      .catch(() => {
        if (!cancelled) setState("down");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, []);

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
        <BrandLockup size="md" />
        <nav className="hidden lg:flex items-center gap-7 text-[15px] text-[#374151]" aria-label="Top">
          <EngineStatus withLatency />
          <SoonLink note="Product documentation ships with the release.">Documentation</SoonLink>
          <SoonLink note="Enterprise support plans are on the way.">Enterprise Support</SoonLink>
          {right}
        </nav>
        <span className="lg:hidden">
          <EngineStatus />
        </span>
      </div>
    </header>
  );
}

export function AuthFooter() {
  return (
    <footer className="bg-[#FFF6E8]/80 backdrop-blur-xl border-t border-[#F3E3C3]/80 shrink-0">
      <div className="px-6 md:px-12 py-3 flex flex-col md:flex-row items-center justify-between gap-2 text-[12px] text-[#6B7280] w-full">
        <p>
          <span className="font-semibold text-[#1F2937]">OtobaAI Platform Inc.</span> © 2026. All rights
          reserved.
        </p>
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2" aria-label="Footer">
          <SoonLink note="The privacy policy ships with the release.">Privacy Policy</SoonLink>
          <SoonLink note="The terms of service ships with the release.">Terms of Service</SoonLink>
          <SoonLink note="The security whitepaper ships with the release.">Security Architecture</SoonLink>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            System Status
          </span>
        </nav>
      </div>
    </footer>
  );
}
