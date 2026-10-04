"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowRight,
  Check,
  KeyRound,
  Mail,
  Radio,
} from "lucide-react";
import { AuthFooter, AuthNavbar, SoonLink } from "@/components/auth/auth-navbar";
import { ComplianceRow, LiveClusterCard, WaveBand } from "@/components/auth/auth-hero";
import { AuthAlert, AuthField, AuthPasswordField, AuthSubmitButton, GoogleMark } from "@/components/auth/fields";
import { BrandLockup } from "@/components/common/brand-lockup";
import { loginSchema, type LoginInput } from "@/lib/schemas/auth";
import { useLogin } from "@/services/auth";
import { notify } from "@/lib/notify";
import { consumeLoginHandoff, hasSuspendedFlag } from "@/lib/auth-routes";
import { useMounted } from "@/lib/use-mounted";

export default function LoginPage() {
  return <LoginContent />;
}

const SSO_BUTTON =
  "w-full h-12 rounded-2xl border border-[#E5E7EB] bg-white text-[15px] font-medium text-[#1F2937] hover:bg-[#FFFBF0] hover:text-[#1F2937] transition-colors flex items-center justify-center gap-2 shadow-sm";

function LoginContent() {
  const router = useRouter();
  // Spec 0041 Slice B — suspended-workspace hint, shown only when the shell
  // banner signs out a suspended workspace (one-shot cookie, read after
  // hydration). A plain sign-out / 401 bounce shows no notice. Copy only —
  // no redirect, so this can never loop.
  const mounted = useMounted();
  const suspendedHint = mounted && hasSuspendedFlag();
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
      router.push(consumeLoginHandoff());
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      setFormError(message);
      notify.error("Login failed", error);
    }
  };

  return (
    <div className="auth-surface min-h-dvh lg:h-dvh bg-[#FFF6E8] text-[#1F2937] flex flex-col lg:overflow-hidden">
      <AuthNavbar
        right={
          <SoonLink topic="api">
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

          <LiveClusterCard />
          <ComplianceRow />
        </div>

        {/* Sign-in card */}
        <div className="relative">
          <div className="absolute -top-1 inset-x-8 h-2 rounded-t-full bg-gradient-to-r from-[#F9B637] via-[#FB6C00] to-[#E73F1E]" aria-hidden="true" />
          <div className="rounded-[2rem] bg-white shadow-[0_32px_80px_-24px_rgba(17,24,39,0.25)] border border-[#F6E8C8] p-6">
            <div className="mb-5">
              <BrandLockup
                size="md"
                tone="light"
                textClassName="text-lg"
                sublabel="WORKSPACE PORTAL"
                sublabelClassName="text-[12px] font-bold tracking-widest text-[#C2410C]"
                link={false}
              />
            </div>

            <h2 className="text-[26px] font-bold tracking-tight text-[#111827]">Welcome back</h2>
            <p className="text-[14px] text-[#6B7280] mt-1 mb-5">Sign in to your OtobaAI workspace console.</p>

            {suspendedHint && (
              <p
                role="status"
                data-testid="workspace-suspended-notice"
                className="text-[13px] leading-relaxed text-[#92400E] rounded-2xl border border-[#F6E8C8] bg-[#FFFBF0] px-4 py-3 mb-5"
              >
                This workspace is suspended — contact your owner to restore access. You can sign in again once access
                is restored.
              </p>
            )}

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
                <label
                  className="flex items-center gap-2.5 text-[#4B5563] cursor-pointer select-none"
                  title="Keeps you signed in on this device for 30 days (otherwise 7 days)."
                >
                  <span className="relative inline-flex shrink-0">
                    <input
                      {...form.register("remember")}
                      type="checkbox"
                      className="peer appearance-none w-[18px] h-[18px] rounded-md border border-[#D1D5DB] bg-white shadow-sm cursor-pointer transition-colors hover:border-[#FB6C00] checked:bg-[#E73F1E] checked:border-[#E73F1E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FB6C00]/40"
                    />
                    <Check
                      className="pointer-events-none absolute inset-0 m-auto w-3 h-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity"
                      strokeWidth={3.5}
                      aria-hidden="true"
                    />
                  </span>
                  Remember me
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
              <SoonLink topic="google" className={SSO_BUTTON}>
                <GoogleMark /> Google
              </SoonLink>
              <SoonLink topic="sso" className={SSO_BUTTON}>
                <KeyRound className="w-4 h-4 text-[#C2410C]" /> SAML / Okta
              </SoonLink>
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
