"use client";

import type { IntegrationKind } from "@/lib/schemas/platform";

export interface FieldDef {
  key: string;
  label: string;
  secret?: boolean;
  multiline?: boolean;
  placeholder?: string;
}

export type IntegrationCategory = "telephony" | "productivity" | "other" | "developers";

/**
 * Single source of truth for the integrations catalog.
 * Moved out of `org-integrations.tsx` so `/integrations`, `/numbers`
 * (ProviderSetup) and future surfaces share one definition.
 *
 * Naming freeze (architect decision):
 * - Tool = agent-attached function/webhook (see /tools)
 * - Template = provider blueprint (MCP)
 * - Credential = vault secret (metadata only in lists)
 * - Link = provider → agent binding
 * - Partner = Talko DID owner (telephony-specific, not generic)
 */
export const KIND_FIELDS: Record<IntegrationKind, { label: string; fields: FieldDef[] }> = {
  twilio: {
    label: "Twilio",
    fields: [
      { key: "account_sid", label: "Account SID", placeholder: "AC…" },
      { key: "auth_token", label: "Auth Token", secret: true },
      { key: "phone_number", label: "Phone Number", placeholder: "+1…" },
    ],
  },
  plivo: {
    label: "Plivo",
    fields: [
      { key: "auth_id", label: "Auth ID" },
      { key: "auth_token", label: "Auth Token", secret: true },
    ],
  },
  exotel: {
    label: "Exotel",
    fields: [
      { key: "sid", label: "SID" },
      { key: "api_key", label: "API Key", secret: true },
      { key: "api_token", label: "API Token", secret: true },
    ],
  },
  vobiz: {
    label: "Vobiz",
    fields: [{ key: "api_key", label: "API Key", secret: true }],
  },
  talko: {
    label: "Talko (Tata Tele trunk)",
    fields: [
      { key: "trunk_url", label: "Trunk URL", placeholder: "http://talko-app:8004" },
      { key: "caller_did", label: "Default caller DID", placeholder: "9179…" },
      { key: "api_key", label: "Talko API Key (default)", secret: true, placeholder: "tkp_live_…" },
    ],
  },
  calcom: {
    label: "Cal.com",
    fields: [
      { key: "api_key", label: "API Key", secret: true },
      { key: "event_type_id", label: "Event Type ID" },
    ],
  },
  n8n: {
    label: "n8n",
    fields: [
      { key: "base_url", label: "Base URL", placeholder: "https://…" },
      { key: "api_key", label: "API Key", secret: true },
    ],
  },
  zapier: {
    label: "Zapier",
    fields: [{ key: "webhook_url", label: "Webhook URL", placeholder: "https://hooks.zapier.com/…" }],
  },
  sheets: {
    label: "Google Sheets",
    fields: [
      { key: "sheet_url", label: "Sheet URL" },
      { key: "service_account_json", label: "Service Account JSON", secret: true, multiline: true },
    ],
  },
  sip: {
    label: "SIP Trunk",
    fields: [
      { key: "host", label: "Host" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password", secret: true },
    ],
  },
  truecaller: {
    label: "Truecaller",
    fields: [
      { key: "api_key", label: "API Key", secret: true },
      { key: "business_name", label: "Business Name" },
    ],
  },
};

export const KINDS = Object.keys(KIND_FIELDS) as IntegrationKind[];

/** Telephony providers that can carry numbers. Reused by the Numbers section. */
export const TELEPHONY_KINDS: IntegrationKind[] = ["twilio", "plivo", "exotel", "vobiz", "talko", "sip"];

export const PRODUCTIVITY_KINDS: IntegrationKind[] = ["calcom", "sheets", "n8n", "zapier"];

export const OTHER_KINDS: IntegrationKind[] = ["truecaller"];

/** Add-integration groupings for the picker. Counts stay honest via useIntegrations(). */
export const ADD_GROUPS: { label: string; kinds: IntegrationKind[] }[] = [
  { label: "Telephony", kinds: [...TELEPHONY_KINDS] },
  { label: "Productivity", kinds: [...PRODUCTIVITY_KINDS, ...OTHER_KINDS] },
];

export function getCategoryForKind(kind: IntegrationKind): IntegrationCategory {
  if ((TELEPHONY_KINDS as readonly string[]).includes(kind)) return "telephony";
  if ((PRODUCTIVITY_KINDS as readonly string[]).includes(kind)) return "productivity";
  if ((OTHER_KINDS as readonly string[]).includes(kind)) return "other";
  return "other";
}

export function filterKindsByCategory(
  kinds: readonly IntegrationKind[],
  category: IntegrationCategory | "all"
): IntegrationKind[] {
  if (category === "all") return [...kinds];
  if (category === "developers") return [];
  if (category === "telephony") return kinds.filter((k) => TELEPHONY_KINDS.includes(k));
  if (category === "productivity")
    return kinds.filter((k) => PRODUCTIVITY_KINDS.includes(k) || OTHER_KINDS.includes(k));
  return kinds.filter((k) => OTHER_KINDS.includes(k));
}
