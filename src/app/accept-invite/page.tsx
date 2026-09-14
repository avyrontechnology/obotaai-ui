"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight } from "lucide-react";
import { AuthFooter, AuthNavbar } from "@/components/auth/auth-navbar";
import { AuthAlert, AuthField, AuthPasswordField, AuthSubmitButton } from "@/components/auth/fields";
import { BrandLockup } from "@/components/common/brand-lockup";
import { FormErrorSummary } from "@/components/settings/error-summary";
import { acceptInviteSchema, type AcceptInviteInput } from "@/lib/schemas/auth";
import { useAcceptInvite } from "@/services/auth";
import { notify } from "@/lib/notify";

/**
 * Invite acceptance. Theme tokens only (no hardcoded hex): surfaces use
 * background/card, text uses foreground/muted-foreground/primary, the
 * brand gradient uses from-primary via-ember-500 to-accent.
 */

export default function AcceptInvitePage() {
  return (
    <Suspense>
      <AcceptContent />
    </Suspense>
  );
}

function AcceptContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const accept = useAcceptInvite();
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<AcceptInviteInput>({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { token, name: "", password: "", confirm: "" },
  });

  const onSubmit = async (data: AcceptInviteInput) => {
    setFormError(null);
    try {
      await accept.mutateAsync(data);
      notify.success("Welcome aboard", { description: "Your account is ready." });
      router.push("/");
      router.refresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invite failed";
      setFormError(message);
      notify.error("Invite failed", error);
    }
  };

  return (
    <div className="min-h-dvh lg:h-dvh bg-background text-foreground flex flex-col lg:overflow-hidden">
      <AuthNavbar />

      <main className="flex-1 min-h-0 w-full max-w-xl mx-auto px-6 flex flex-col items-center justify-center py-8">
        <div className="relative w-full">
          <div
            className="absolute -top-1 inset-x-10 h-2 rounded-t-full bg-gradient-to-r from-primary via-ember-500 to-accent"
            aria-hidden="true"
          />
          <div className="rounded-[2rem] bg-card shadow-[0_32px_80px_-24px_color-mix(in_srgb,var(--foreground)_25%,transparent)] border border-border p-6 md:p-8">
            <div className="mb-5">
              <BrandLockup
                size="md"
                textClassName="text-lg"
                sublabel="INVITE"
                sublabelClassName="text-[12px] font-bold tracking-widest text-primary"
                link={false}
              />
            </div>

            {token ? (
              <>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Accept invite</h1>
                <p className="text-[14px] text-muted-foreground mt-1 mb-5">
                  Set your name and password to join the workspace.
                </p>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                  <FormProvider {...form}>
                  <FormErrorSummary title="Please fix the following before joining" />
                  <AuthField
                    name="name"
                    label="FULL NAME"
                    type="text"
                    autoComplete="name"
                    placeholder="Asha Sharma"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <AuthPasswordField name="password" label="PASSWORD" autoComplete="new-password" />
                    <AuthPasswordField
                      name="confirm"
                      label="CONFIRM"
                      autoComplete="new-password"
                      placeholder="Repeat it"
                    />
                  </div>
                  {formError && <AuthAlert message={formError} />}
                  <AuthSubmitButton loading={accept.isPending}>
                    Join workspace <ArrowRight className="w-5 h-5" aria-hidden="true" />
                  </AuthSubmitButton>
                  </FormProvider>
                </form>
              </>
            ) : (
              <>
                <h1 className="text-[26px] font-bold tracking-tight text-foreground">Invalid invite</h1>
                <p className="text-[14px] text-muted-foreground mt-1 mb-5">
                  This invite link is missing its token. Ask your workspace owner for a fresh invite.
                </p>
                <Link
                  href="/login"
                  className="flex items-center justify-center h-11 rounded-2xl bg-gradient-to-r from-[#E73F1E] to-[#FB6C00] text-white font-semibold text-[16px] hover:brightness-105 cursor-pointer transition-all duration-200 motion-reduce:transition-none shadow-[0_16px_32px_-12px_rgba(231,63,30,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-card"
                >
                  Go to sign in
                </Link>
              </>
            )}

            <p className="mt-4 text-center text-[14px] text-muted-foreground">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold text-primary hover:text-primary/80 hover:underline underline-offset-4 cursor-pointer transition-colors duration-200 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 motion-reduce:transition-none">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </main>

      <AuthFooter />
    </div>
  );
}
