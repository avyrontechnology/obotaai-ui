"use client";

import { useFormContext, useWatch } from "react-hook-form";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/common/toggle";
import { ReactNode, memo } from "react";
import { motion, Variants } from "framer-motion";

interface FormFieldProps {
  name: string;
  label: string;
  description?: string;
  className?: string;
}

/**
 * Read a react-hook-form error by dotted path ("agent_config.llm.model").
 * RHF nests errors, so a flat lookup never matches and messages stay hidden.
 */
export function getFieldError(errors: Record<string, unknown>, name: string): string | undefined {
  const parts = name.split(".");
  let current: unknown = errors;
  for (const part of parts) {
    if (current === null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  if (current !== null && typeof current === "object" && typeof (current as Record<string, unknown>).message === "string") {
    return (current as Record<string, unknown>).message as string;
  }
  return undefined;
}

/**
 * First human-readable message in a nested RHF errors object, for toasts.
 */
export function firstErrorMessage(errors: Record<string, unknown>): string {
  const stack: unknown[] = [errors];
  while (stack.length > 0) {
    const current = stack.shift();
    if (current !== null && typeof current === "object") {
      const record = current as Record<string, unknown>;
      if (typeof record.message === "string") return record.message;
      stack.push(...Object.values(record));
    }
  }
  return "Please fix the highlighted fields.";
}

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 300, damping: 24 } },
};

export function FormSection({ title, description, children }: { title: string, description?: string, children: ReactNode }) {
  return (
    <motion.div variants={itemVariants} className="mb-10 last:mb-0">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-foreground">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-w-0"
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

export const TextInput = memo(function TextInput({ name, label, description, className, placeholder, type = "text" }: FormFieldProps & { placeholder?: string, type?: string }) {
  const { register, formState: { errors } } = useFormContext();
  const error = getFieldError(errors as Record<string, unknown>, name);

  return (
    <motion.div variants={itemVariants} className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
      >
        {/* setValueAs (not valueAsNumber): a cleared number field submits
            undefined so optional zod numbers pass, instead of NaN which
            fails int() checks and blocks the whole save. */}
        <input
          {...register(name, type === "number"
            ? { setValueAs: (value) => (value === "" || value === null ? undefined : Number(value)) }
            : undefined)}
          type={type}
          id={name}
          placeholder={placeholder}
          className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner"
        />
      </motion.div>
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </motion.div>
  );
});

export const SelectInput = memo(function SelectInput({ name, label, description, className, options }: FormFieldProps & { options: { label: string, value: string }[] }) {
  const { register, formState: { errors } } = useFormContext();
  const error = getFieldError(errors as Record<string, unknown>, name);

  return (
    <motion.div variants={itemVariants} className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className="relative"
      >
        {/* setValueAs: the disabled placeholder option submits "" — map it
            to undefined so optional fields (reasoning_effort, telephony,
            …) validate and stay omitted instead of failing zod enums or
            writing phantom values. Required selects still fail on
            undefined via min(1)/enum as before. */}
        <select
          {...register(name, { setValueAs: (value) => (value === "" ? undefined : value) })}
          id={name}
          className="w-full appearance-none bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner"
        >
          {/* NOT disabled: a disabled placeholder is skipped by default
            selection, so an untouched select would submit the first real
            option as a phantom value. Selectable placeholder submits ""
            instead, which setValueAs maps to undefined. */}
          <option value="">Select an option...</option>
          {options.map(opt => (
            <option key={opt.value} value={opt.value} className="bg-card text-foreground">{opt.label}</option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2.5 4.5L6 8L9.5 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </motion.div>
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </motion.div>
  );
});

export const SwitchInput = memo(function SwitchInput({ name, label, description, className }: FormFieldProps) {
  const { register, setValue } = useFormContext();
  const isChecked = useWatch({ name });

  return (
    <motion.div 
      variants={itemVariants}
      whileHover={{ scale: 1.01 }}
      className={cn("flex items-start justify-between gap-4 p-4 rounded-xl bg-muted/50 border border-border", className)}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor={name} className="text-sm font-medium text-foreground cursor-pointer">
          {label}
        </label>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Toggle
        checked={!!isChecked}
        onChange={(value) => setValue(name, value, { shouldDirty: true })}
        label={label}
      />
      {/* Hidden input to register with form */}
      <input type="checkbox" id={name} {...register(name)} className="hidden" />
    </motion.div>
  );
});

export const TextareaInput = memo(function TextareaInput({ name, label, description, className, placeholder, rows = 4 }: FormFieldProps & { placeholder?: string, rows?: number }) {
  const { register, formState: { errors } } = useFormContext();
  const error = getFieldError(errors as Record<string, unknown>, name);

  return (
    <motion.div variants={itemVariants} className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <textarea
        {...register(name)}
        id={name}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner resize-y"
      />
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </motion.div>
  );
});
