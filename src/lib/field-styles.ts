/** Canonical form-field classes. Use these instead of local `inputClass` copies. */
export const fieldStyles = {
  field:
    "h-11 px-4 bg-card border border-border rounded-2xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 transition-all placeholder:text-muted-foreground w-full",
  fieldSm:
    "h-10 px-3 bg-card border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50 transition-all placeholder:text-muted-foreground w-full",
  fieldMuted:
    "w-full h-12 px-4 bg-muted/50 border border-border rounded-2xl focus:outline-none focus:ring-1 focus:ring-ember-400/50 transition-all text-sm shadow-sm text-foreground placeholder:text-muted-foreground",
} as const;
