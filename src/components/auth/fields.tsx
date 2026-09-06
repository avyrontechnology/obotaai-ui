"use client";

import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormContext } from "react-hook-form";
import { Eye, EyeOff, Loader2, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { getFieldError } from "@/components/settings/form-controls";

/**
 * The one auth field system (login / accept-invite). Every field
 * gets: visible label, programmatic name association, aria-invalid +
 * aria-describedby error wiring, and role=alert errors. One token set —
 * white inputs, h-11 controls, ember focus.
 */

export const AUTH_INPUT_CLASS =
  "w-full h-11 bg-white border border-[#E5E7EB] rounded-2xl text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#FB6C00]/40 focus:border-[#FB6C00] transition-all shadow-sm";

export function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.44 8.55 1 10.22 1 12s.44 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

interface AuthFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "name"> {
  name: string;
  label: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
}

export function AuthField({ name, label, icon, action, className, ...inputProps }: AuthFieldProps) {
  const {
    register,
    formState: { errors },
  } = useFormContext();
  const error = getFieldError(errors as Record<string, unknown>, name);
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[13px] font-semibold tracking-wider text-[#374151]">
        {label}
      </label>
      <div className="relative">
        {icon && (
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#9CA3AF] pointer-events-none [&>svg]:w-[18px] [&>svg]:h-[18px]">
            {icon}
          </span>
        )}
        <input
          id={id}
          {...register(name)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={cn(AUTH_INPUT_CLASS, icon && "pl-11", action && "pr-12", className)}
          {...inputProps}
        />
        {action && <span className="absolute right-4 top-1/2 -translate-y-1/2">{action}</span>}
      </div>
      {error && (
        <span id={errorId} role="alert" className="text-xs text-red-700">
          {error}
        </span>
      )}
    </div>
  );
}

export function AuthPasswordField({
  name,
  label,
  autoComplete = "current-password",
  placeholder = "••••••••••",
}: {
  name: string;
  label: ReactNode;
  autoComplete?: string;
  placeholder?: string;
}) {
  const [showPassword, setShowPassword] = useState(false);
  return (
    <AuthField
      name={name}
      label={label}
      type={showPassword ? "text" : "password"}
      autoComplete={autoComplete}
      placeholder={placeholder}
      icon={<LockKeyhole aria-hidden="true" />}
      action={
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? "Hide password" : "Show password"}
          aria-pressed={showPassword}
          className="text-[#9CA3AF] hover:text-[#4B5563] transition-colors"
        >
          {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
        </button>
      }
    />
  );
}

export function AuthSubmitButton({
  loading,
  children,
}: {
  loading?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="w-full h-11 rounded-2xl bg-gradient-to-r from-[#E73F1E] to-[#FB6C00] text-white font-semibold text-[16px] hover:brightness-105 disabled:opacity-50 transition-all shadow-[0_16px_32px_-12px_rgba(231,63,30,0.55)] flex items-center justify-center gap-2"
    >
      {loading ? <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> : children}
    </button>
  );
}

export function AuthAlert({ message }: { message: string }) {
  return (
    <p role="alert" className="text-sm text-red-700 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
      {message}
    </p>
  );
}
