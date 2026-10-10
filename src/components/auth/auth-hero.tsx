import { Cpu, Lock, Radio, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/* Shared marketing hero pieces for the auth pages (login / signup), so both
   left columns carry the same live-cluster card, compliance row and wave. */

const EQ_BARS = [0.5, 0.9, 0.65, 1, 0.45, 0.8, 0.6];

function Equalizer() {
  return (
    <span className="flex items-end gap-[3px] h-6" aria-hidden="true">
      {EQ_BARS.map((height, index) => (
        <span
          key={index}
          className="eq-bar w-[3px] rounded-full bg-gradient-to-t from-[#E73F1E] to-[#F9B637]"
          style={{ height: `${Math.round(height * 100)}%`, animationDelay: `${index * 0.13}s` }}
        />
      ))}
    </span>
  );
}

export function WaveBand({ id, className, opacity }: { id: string; className?: string; opacity: number }) {
  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden="true">
      <div className="wave-drift-slow flex w-[200%] h-full">
        {[0, 1].map((copy) => (
          <svg key={copy} viewBox="0 0 600 120" preserveAspectRatio="none" className="w-1/2 h-full shrink-0">
            <defs>
              <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#E73F1E" />
                <stop offset="55%" stopColor="#FB6C00" />
                <stop offset="100%" stopColor="#F9B637" />
              </linearGradient>
            </defs>
            <path
              d="M0,60 C50,20 100,20 150,60 C200,100 250,100 300,60 C350,20 400,20 450,60 C500,100 550,100 600,60"
              fill="none"
              stroke={`url(#${id}-stroke)`}
              strokeWidth="9"
              strokeLinecap="round"
              opacity={opacity}
            />
          </svg>
        ))}
      </div>
    </div>
  );
}

export function LiveClusterCard() {
  return (
    <div className="mt-6 max-w-xl rounded-3xl bg-white border border-[#F6E8C8] shadow-[0_24px_60px_-24px_rgba(231,63,30,0.25)] p-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex items-center justify-center w-11 h-11 rounded-2xl bg-gradient-to-br from-[#E73F1E] to-[#FB6C00] text-white shrink-0 shadow-md">
            <Radio className="w-5 h-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[13px] font-bold tracking-wide text-[#C2410C]">ACTIVE LIVE CLUSTER</p>
            <p className="font-mono text-[15px] text-[#111827] truncate">us-east-speech-edge-04</p>
          </div>
        </div>
        <span className="flex items-center rounded-xl border border-[#F6E8C8] bg-[#FFFBF0] px-3 py-2 shrink-0">
          <Equalizer />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-[#F6E8C8]">
        {[
          { label: "WebRTC Latency", value: "< 114 ms", tone: "text-[#111827]" },
          { label: "Synthesizer Accuracy", value: "99.98%", tone: "text-emerald-600" },
          { label: "Global Voices", value: "48 Dialects", tone: "text-[#111827]" },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-[13px] text-[#6B7280]">{stat.label}</p>
            <p className={cn("text-lg font-bold tracking-tight", stat.tone)}>{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ComplianceRow() {
  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#6B7280]">
      <span className="inline-flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-[#C2410C]" /> SOC2 Type II Certified
      </span>
      <span className="text-[#F9B637]" aria-hidden="true">
        •
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Lock className="w-4 h-4 text-[#C2410C]" /> HIPAA Compliant
      </span>
      <span className="text-[#F9B637]" aria-hidden="true">
        •
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Cpu className="w-4 h-4 text-[#C2410C]" /> Zero-Retention Option
      </span>
    </div>
  );
}
