"use client";

import { memo } from "react";
import { useFormContext, useController } from "react-hook-form";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { getFieldError } from "./form-controls";

interface JsonTextFieldProps {
  name: string;
  label: string;
  description?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Text input bound to a string|dict form value.
 *
 * - Objects display as compact JSON (so legacy dict rows never crash the form).
 * - Edits attempt JSON.parse with raw-string fallback so typing never wipes.
 * - Empty submits undefined (mirrors TextInput's number setValueAs pattern).
 */
export const JsonTextField = memo(function JsonTextField({
  name,
  label,
  description,
  placeholder,
  className,
}: JsonTextFieldProps) {
  const { control, formState } = useFormContext();
  const { field } = useController({ name, control });
  const error = getFieldError(formState.errors as Record<string, unknown>, name);

  const raw = field.value as string | Record<string, unknown> | null | undefined;
  const display = raw == null ? "" : typeof raw === "string" ? raw : JSON.stringify(raw);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    if (value === "") {
      field.onChange(undefined);
      return;
    }
    try {
      field.onChange(JSON.parse(value));
    } catch {
      field.onChange(value);
    }
  };

  return (
    <motion.div variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } }} className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={name} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={name}
        name={field.name}
        ref={field.ref}
        value={display}
        onChange={handleChange}
        onBlur={field.onBlur}
        placeholder={placeholder}
        className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ember-400/50 focus:border-ember-400/50 transition-all shadow-inner"
      />
      {description && !error && <p className="text-xs text-muted-foreground">{description}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </motion.div>
  );
});
