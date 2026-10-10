"use client";

import { CalendarClock, MessagesSquare, Phone, Plug, PlugZap, Sheet, Webhook, Zap } from "lucide-react";
import type { IntegrationKind } from "@/lib/schemas/platform";

/**
 * One icon per category — previously every card used the same Plug icon,
 * so scanning Telephony vs Productivity was impossible.
 */
const KIND_ICONS: Partial<Record<IntegrationKind, typeof Phone>> = {
  twilio: Phone,
  plivo: Phone,
  exotel: Phone,
  vobiz: Phone,
  talko: Phone,
  sip: Phone,
  calcom: CalendarClock,
  n8n: Webhook,
  zapier: Zap,
  sheets: Sheet,
  truecaller: MessagesSquare,
};

export function ProviderIcon({ kind }: { kind: IntegrationKind | "mcp" | "talko-partner" }) {
  const Icon =
    kind === "mcp" ? PlugZap : kind === "talko-partner" ? Phone : (KIND_ICONS[kind as IntegrationKind] ?? Plug);
  return (
    <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
      <Icon className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
    </div>
  );
}
