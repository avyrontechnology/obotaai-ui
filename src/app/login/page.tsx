"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Cpu,
  KeyRound,
  Lock,
  Mail,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { AuthFooter, AuthNavbar, SoonLink } from "@/components/auth/auth-navbar";
import { AuthAlert, AuthField, AuthPasswordField, AuthSubmitButton, GoogleMark } from "@/components/auth/fields";
import { BrandLockup } from "@/components/common/brand-lockup";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { useLogin } from "@/services/auth";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}

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

function WaveBand({ id, className, opacity }: { id: string; className?: string; opacity: number }) {
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

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/";
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const [showResetNote, setShowResetNote] = useState(false);

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "", remember: false },
  });

  const onSubmit = async (data: LoginInput) => {
    setFormError(null);
    try {
      await login.mutateAsync(data);
      router.push(next);
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setFormError(message);
      notify.error("Login failed", error);
    }
  };

  return (
    <div className="min-h-dvh lg:h-dvh bg-[#FFF6E8] text-[#1F2937] flex flex-col lg:overflow-hidden">
      <AuthNavbar
        right={
          <SoonLink note="The public API reference ships with the release.">
            <span className="inline-flex items-center h-9 px-4 rounded-xl border border-[#F3D9A8] text-[#C2410C] font-semibold text-sm bg-white/60">
              API V2.4
            </span>
          </SoonLink>
        }
      />

      {/* Body */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-6 md:px-10 grid lg:grid-cols-2 gap-8 xl:gap-12 items-center py-6 relative">
        <WaveBand id="hero-wave" className="absolute inset-x-0 top-6 h-28 opacity-40" opacity={0.35} />

        {/* Hero */}
        <div className="relative pt-6">
          <p className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white border border-[#F3E3C3] text-[13px] font-semibold tracking-wide text-[#C2410C] shadow-sm mb-4">
            <Radio className="w-4 h-4" />
            REAL-TIME ACOUSTIC ORCHESTRATION
          </p>
          <h1 className="text-4xl xl:text-[52px] font-bold leading-[1.05] tracking-tight text-[#111827]">
            Build, test &amp; orchestrate
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E73F1E] via-[#FB6C00] to-[#F9B637]">
              real-time voice agents.
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#4B5563] max-w-xl">
            Enterprise orchestration layer with sub-second bi-directional conversational pipelines,
            WebRTC low-latency streaming, and fine-tuned agentic models.
          </p>

          {/* Live cluster card */}
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

          {/* Compliance */}
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
        </div>

        {/* Sign-in card */}
        <div className="relative">
          <div className="absolute -top-1 inset-x-8 h-2 rounded-t-full bg-gradient-to-r from-[#F9B637] via-[#FB6C00] to-[#E73F1E]" aria-hidden="true" />
          <div className="rounded-[2rem] bg-white shadow-[0_32px_80px_-24px_rgba(17,24,39,0.25)] border border-[#F6E8C8] p-6">
            <div className="mb-5">
              <BrandLockup
                size="md"
                textClassName="text-lg"
                sublabel="WORKSPACE PORTAL"
                sublabelClassName="text-[12px] font-bold tracking-widest text-[#C2410C]"
                link={false}
              />
            </div>

            <h2 className="text-[26px] font-bold tracking-tight text-[#111827]">Welcome back</h2>
            <p className="text-[14px] text-[#6B7280] mt-1 mb-5">Sign in to your OtobaAI workspace console.</p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormProvider {...form}>
              <AuthField
                name="email"
                label="EMAIL"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                icon={<Mail aria-hidden="true" />}
              />
              <AuthPasswordField name="password" label="PASSWORD" />

              <div className="flex items-center justify-between text-[14px]">
                <label className="flex items-center gap-2.5 text-[#4B5563] cursor-pointer select-none">
                  <input
                    {...form.register("remember")}
                    type="checkbox"
                    className="w-[18px] h-[18px] rounded-md border-[#D1D5DB] accent-[#E73F1E] cursor-pointer"
                  />
                  Remember for 30 days
                </label>
                <button
                  type="button"
                  onClick={() => setShowResetNote((value) => !value)}
                  className="font-medium text-[#C2410C] hover:underline underline-offset-4"
                >
                  Forgot password?
                </button>
              </div>
              {showResetNote && (
                <p className="text-[13px] leading-relaxed text-[#6B7280] rounded-2xl border border-[#F6E8C8] bg-[#FFFBF0] px-4 py-3">
                  Self-serve resets aren&apos;t available yet — ask your workspace owner to remove and
                  re-invite your account.
                </p>
              )}

              {formError && <AuthAlert message={formError} />}

              <AuthSubmitButton loading={login.isPending}>
                Sign in <ArrowRight className="w-5 h-5" aria-hidden="true" />
              </AuthSubmitButton>
              </FormProvider>
            </form>

            <div className="flex items-center gap-4 my-4" aria-hidden="true">
              <span className="flex-1 h-px bg-[#EFE3C8]" />
              <span className="text-[13px] text-[#6B7280]">or continue with</span>
              <span className="flex-1 h-px bg-[#EFE3C8]" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => notify.info("Coming soon", { description: "Google sign-in is on the roadmap." })}
                className="h-12 rounded-2xl border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#1F2937] hover:bg-[#FFFBF0] transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <GoogleMark /> Google
              </button>
              <button
                type="button"
                onClick={() => notify.info("Coming soon", { description: "SAML/Okta SSO ships on enterprise plans." })}
                className="h-12 rounded-2xl border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#1F2937] hover:bg-[#FFFBF0] transition-colors flex items-center justify-center gap-2 shadow-sm"
              >
                <KeyRound className="w-4 h-4 text-[#C2410C]" /> SAML / Okta
              </button>
            </div>

            <p className="mt-4 text-center text-[14px] text-[#6B7280]">
              New to a workspace? Ask your owner for an invite link.
              <br />
              Setting up a fresh workspace?{" "}
              <Link href="/signup" className="font-medium text-[#C2410C] hover:underline underline-offset-4">
                Create the owner account
              </Link>
            </p>
          </div>
        </div>
      </main>

      <AuthFooter />
    </div>
  );
}
