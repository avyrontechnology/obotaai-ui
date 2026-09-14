"use client";

import { Suspense, useEffect, useState } from "react";
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
import { FormErrorSummary } from "@/components/settings/error-summary";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { useLogin, useSession } from "@/services/auth";
import { notify } from "@/lib/notify";
import { cn } from "@/lib/utils";

/** Invite-only guard: only same-origin absolute paths are valid `?next=` targets. */
export function resolveNextParam(raw: string | null): string {
  if (!raw) return "/";
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

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
          className="w-[3px] rounded-full bg-muted-foreground/60"
          style={{ height: `${Math.round(height * 100)}%`, animationDelay: `${index * 0.13}s` }}
        />
      ))}
    </span>
  );
}

function WaveBand({ id, className, opacity }: { id: string; className?: string; opacity: number }) {
  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden="true">
      <div className="flex w-[200%] h-full">
        {[0, 1].map((copy) => (
          <svg key={copy} viewBox="0 0 600 120" preserveAspectRatio="none" className="w-1/2 h-full shrink-0">
            <defs>
              <linearGradient id={`${id}-stroke`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" style={{ stopColor: "var(--primary)" }} />
                <stop offset="55%" style={{ stopColor: "var(--color-ember-500)" }} />
                <stop offset="100%" style={{ stopColor: "var(--accent)" }} />
              </linearGradient>
            </defs>
            <path
              d="M0,60 C50,20 100,20 150,60 C200,100 250,100 300,60 C350,20 400,20 450,60 C500,100 550,100 600,60"
              fill="none"
              stroke={`url(#${id}-stroke)`}
              strokeWidth="2"
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
  // Sanitize ?next= so a crafted login link cannot bounce to an off-site URL.
  const next = resolveNextParam(searchParams.get("next"));
  const login = useLogin();
  const [formError, setFormError] = useState<string | null>(null);
  const [showResetNote, setShowResetNote] = useState(false);

  // If a session already exists (cross-site UI/API where proxy cannot see the
  // cookie), skip the form and bounce home — proxy handles same-site.
  // Effect-only navigation: no setState-in-effect cascade (router.replace is
  // not React state).
  const { data: session } = useSession();
  useEffect(() => {
    if (session?.user) router.replace(next);
  }, [session, router, next]);

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
    <div className="min-h-dvh lg:h-dvh bg-background text-foreground flex flex-col lg:overflow-hidden">
      <AuthNavbar
        right={
          <SoonLink note="The public API reference ships with the release.">
            <span className="inline-flex items-center h-9 px-4 rounded-xl border border-border text-primary font-semibold text-sm bg-card/60">
              API V2.4
            </span>
          </SoonLink>
        }
      />

      {/* Body */}
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-6 md:px-10 grid lg:grid-cols-2 gap-8 xl:gap-12 items-center py-6 relative">
        <WaveBand id="hero-wave" className="absolute inset-x-0 top-6 h-16 opacity-30" opacity={0.15} />

        {/* Hero */}
        <div className="relative pt-6">
          <p className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-card border border-border text-[13px] font-semibold tracking-normal text-foreground shadow-sm mb-4">
            <Radio className="w-4 h-4" />
            REAL-TIME ACOUSTIC ORCHESTRATION
          </p>
          <h1 className="text-4xl xl:text-[52px] font-bold leading-[1.05] tracking-tight text-foreground">
            Build, test &amp; orchestrate
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-ember-500 to-accent">
              real-time voice agents.
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground max-w-xl">
            Enterprise orchestration layer with sub-second bi-directional conversational pipelines,
            WebRTC low-latency streaming, and fine-tuned agentic models.
          </p>

          {/* Live cluster card */}
          <div className="mt-6 max-w-xl rounded-3xl bg-card border border-border shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--foreground)_12%,transparent)] p-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <span className="flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-[#A82D11] to-[#7A230D] text-white shrink-0 shadow-md">
                  <Radio className="w-5 h-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-bold tracking-normal text-muted-foreground">ACTIVE LIVE CLUSTER</p>
                  <p className="font-mono text-[15px] text-foreground truncate">us-east-speech-edge-04</p>
                </div>
              </div>
              <span className="flex items-center rounded-xl border border-border bg-muted px-3 py-2 shrink-0">
                <Equalizer />
              </span>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border">
              {[
                { label: "WebRTC Latency", value: "< 114 ms", tone: "text-foreground" },
                { label: "Synthesizer Accuracy", value: "99.98%", tone: "text-emerald-600" },
                { label: "Global Voices", value: "48 Dialects", tone: "text-foreground" },
              ].map((stat) => (
                <div key={stat.label}>
                  <p className="text-[13px] text-muted-foreground">{stat.label}</p>
                  <p className={cn("text-lg font-bold tracking-tight", stat.tone)}>{stat.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance */}
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-muted-foreground" /> SOC2 Type II Certified
            </span>
            <span className="text-accent" aria-hidden="true">
              •
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-muted-foreground" /> HIPAA Compliant
            </span>
            <span className="text-accent" aria-hidden="true">
              •
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-muted-foreground" /> Zero-Retention Option
            </span>
          </div>
        </div>

        {/* Sign-in card */}
        <div className="relative">
          <div className="absolute -top-1 inset-x-8 h-1 rounded-t-full bg-gradient-to-r from-accent via-ember-500 to-primary" aria-hidden="true" />
          <div className="rounded-3xl bg-card shadow-[0_8px_24px_-12px_color-mix(in_srgb,var(--foreground)_12%,transparent)] border border-border p-6">
            <div className="mb-5">
              <BrandLockup
                size="md"
                textClassName="text-lg"
                sublabel="WORKSPACE PORTAL"
                sublabelClassName="text-[13px] font-bold tracking-normal text-muted-foreground"
                link={false}
              />
            </div>

            <h2 className="text-[26px] font-bold tracking-tight text-foreground">Welcome back</h2>
            <p className="text-[14px] text-muted-foreground mt-1 mb-5">Sign in to your OtobaAI workspace console.</p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormProvider {...form}>
              <FormErrorSummary title="Please fix the following before signing in" />
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
                <label className="flex items-center gap-2.5 text-muted-foreground cursor-pointer select-none min-h-[44px] py-1">
                  <input
                    {...form.register("remember")}
                    type="checkbox"
                    className="w-[28px] h-[28px] rounded-md border-input accent-primary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                  />
                  Remember for 30 days
                </label>
                <button
                  type="button"
                  onClick={() => setShowResetNote((value) => !value)}
                  aria-expanded={showResetNote}
                  className="inline-flex items-center justify-center min-h-[44px] px-2 font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 cursor-pointer transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none"
                >
                  Forgot password?
                </button>
              </div>
              {showResetNote && (
                <p className="text-[13px] leading-relaxed text-muted-foreground rounded-xl border border-border bg-muted px-4 py-3">
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
              <span className="flex-1 h-px bg-border" />
              <span className="text-[13px] text-muted-foreground">or continue with</span>
              <span className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => notify.info("Coming soon", { description: "Google sign-in is on the roadmap." })}
                className="h-11 rounded-xl border border-input bg-card text-[15px] font-medium text-foreground hover:bg-muted cursor-pointer transition-colors duration-200 motion-reduce:transition-none flex items-center justify-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <GoogleMark /> Google
              </button>
              <button
                type="button"
                onClick={() => notify.info("Coming soon", { description: "SAML/Okta SSO ships on enterprise plans." })}
                className="h-11 rounded-xl border border-input bg-card text-[15px] font-medium text-foreground hover:bg-muted cursor-pointer transition-colors duration-200 motion-reduce:transition-none flex items-center justify-center gap-2 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
              >
                <KeyRound className="w-4 h-4 text-primary" aria-hidden="true" /> SAML / Okta
              </button>
            </div>

            <p className="mt-4 text-center text-[14px] text-muted-foreground">
              New to a workspace? Ask your owner for an invite link.
              <br />
              Setting up a fresh workspace?{" "}
              <Link href="/signup" className="font-medium text-primary hover:text-primary/80 hover:underline underline-offset-4 cursor-pointer transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none">
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
