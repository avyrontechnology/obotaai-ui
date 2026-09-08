"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormProvider, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, ShieldCheck, UserPlus } from "lucide-react";
import { AuthFooter, AuthNavbar } from "@/components/auth/auth-navbar";
import { AuthAlert, AuthField, AuthPasswordField, AuthSubmitButton } from "@/components/auth/fields";
import { BrandLockup } from "@/components/common/brand-lockup";
import { ApiError } from "@/lib/api-client";
import { signupSchema, type SignupInput } from "@/lib/schemas/auth";
import { useSignup } from "@/services/auth";
import { notify } from "@/lib/notify";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupContent />
    </Suspense>
  );
}

function SignupContent() {
  const router = useRouter();
  const signup = useSignup();
  const [formError, setFormError] = useState<string | null>(null);
  const [closed, setClosed] = useState(false);

  const form = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { email: "", name: "", password: "", confirm: "" },
  });

  const onSubmit = async (data: SignupInput) => {
    setFormError(null);
    setClosed(false);
    try {
      await signup.mutateAsync(data);
      router.push("/");
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.status === 403) {
        setClosed(true);
        setFormError("This workspace already has an owner.");
      } else {
        const message = error instanceof Error ? error.message : "Signup failed";
        setFormError(message);
      }
      notify.error("Signup failed", error);
    }
  };

  return (
    <div className="min-h-dvh lg:h-dvh bg-[#FFF6E8] text-[#1F2937] flex flex-col lg:overflow-hidden">
      <AuthNavbar />
      <main className="flex-1 min-h-0 w-full max-w-7xl mx-auto px-6 md:px-10 grid lg:grid-cols-2 gap-8 xl:gap-12 items-center py-6 relative">
        <div className="relative pt-6">
          <p className="inline-flex items-center gap-2 h-9 px-4 rounded-full bg-white border border-[#F3E3C3] text-[13px] font-semibold tracking-wide text-[#C2410C] shadow-sm mb-4">
            <UserPlus className="w-4 h-4" />
            FIRST-RUN SETUP
          </p>
          <h1 className="text-4xl xl:text-[52px] font-bold leading-[1.05] tracking-tight text-[#111827]">
            Create your
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#E73F1E] via-[#FB6C00] to-[#F9B637]">
              owner account.
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#4B5563] max-w-xl">
            The first account on a fresh workspace becomes its owner. After this,
            signup closes and teammates join by invite.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#6B7280]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-[#C2410C]" /> You control invites &amp; roles
            </span>
          </div>
        </div>

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

            <h2 className="text-[26px] font-bold tracking-tight text-[#111827]">Set up workspace</h2>
            <p className="text-[14px] text-[#6B7280] mt-1 mb-5">Create the owner account to get started.</p>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <FormProvider {...form}>
                <AuthField
                  name="name"
                  label="NAME"
                  type="text"
                  autoComplete="name"
                  placeholder="Ada Lovelace"
                />
                <AuthField
                  name="email"
                  label="EMAIL"
                  type="email"
                  autoComplete="email"
                  placeholder="you@company.com"
                />
                <AuthPasswordField name="password" label="PASSWORD" autoComplete="new-password" />
                <AuthPasswordField name="confirm" label="CONFIRM PASSWORD" autoComplete="new-password" />

                {formError && <AuthAlert message={formError} />}
                {closed && (
                  <p className="text-[14px] text-[#4B5563]">
                    Already set up?{" "}
                    <Link href="/login" className="font-medium text-[#C2410C] hover:underline underline-offset-4">
                      Sign in
                    </Link>
                  </p>
                )}

                <AuthSubmitButton loading={signup.isPending}>
                  Create owner account <ArrowRight className="w-5 h-5" aria-hidden="true" />
                </AuthSubmitButton>
              </FormProvider>
            </form>

            <p className="mt-4 text-center text-[14px] text-[#6B7280]">
              Already set up?{" "}
              <Link href="/login" className="font-medium text-[#C2410C] hover:underline underline-offset-4">
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
