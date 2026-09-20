"use client";

import { useState } from "react";
import { AlertCircle, Loader2, PhoneCall, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/common/modal";
import { fieldStyles } from "@/lib/field-styles";
import { useAgents } from "@/services/api";
import { usePlaceCall } from "@/services/platform/executions";
import { useTalkoPartners } from "@/services/platform/talko-partners";
import { minRoleFor, useCan } from "@/lib/rbac";
import { cn } from "@/lib/utils";

const FEE_DEMO_VARIABLES = JSON.stringify(
  {
    student_name: "Aarav Sharma",
    class: "XI-A",
    outstanding: 28500,
    parent_name: "Mr. Sharma",
  },
  null,
  2
);

interface PlaceCallDialogProps {
  open: boolean;
  onClose: () => void;
  initialAgentId?: string;
}

function parseVariablesJson(raw: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw.trim()) return { ok: true, value: {} };
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { ok: false, error: "Variables must be a JSON object." };
    }
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Variables is not valid JSON." };
  }
}

export function PlaceCallDialog({ open, onClose, initialAgentId = "" }: PlaceCallDialogProps) {
  const router = useRouter();
  const { data: agents } = useAgents();
  const { data: partners } = useTalkoPartners();
  const placeCall = usePlaceCall();

  const [agentOverride, setAgentOverride] = useState<string | null>(null);
  const agentId = agentOverride ?? initialAgentId;
  const effectiveAgentId = agentId || agents?.[0]?.agent_id || "";
  const [toNumber, setToNumber] = useState("");
  const [fromNumber, setFromNumber] = useState("");
  const [provider, setProvider] = useState<"simulated" | "talko">("simulated");
  const [talkoApiKey, setTalkoApiKey] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [variablesRaw, setVariablesRaw] = useState(FEE_DEMO_VARIABLES);

  const handlePartnerChange = (value: string) => {
    setPartnerId(value);
    const partner = (partners ?? []).find((p) => p.partner_id === value);
    if (partner) {
      setProvider("talko");
      setFromNumber(partner.default_did ?? partner.dids?.[0] ?? "");
      setTalkoApiKey("");
    } else {
      setFromNumber("");
    }
  };

  const selectedPartner = (partners ?? []).find((p) => p.partner_id === partnerId) ?? null;
  const partnerDids = selectedPartner?.dids ?? [];

  const canWrite = useCan("calls.simulate");
  const parsed = parseVariablesJson(variablesRaw);
  const canSubmit =
    canWrite && effectiveAgentId && toNumber.trim().length > 0 && parsed.ok && !placeCall.isPending;

  const handleSubmit = async () => {
    if (!canSubmit || !parsed.ok) return;
    try {
      const execution = await placeCall.mutateAsync({
        agent_id: effectiveAgentId,
        to_number: toNumber.trim(),
        from_number: fromNumber.trim() || undefined,
        variables: parsed.value,
        provider,
        talko_api_key: talkoApiKey.trim() || undefined,
        partner_id: partnerId || undefined,
        delay_scale: 0.5,
      });
      onClose();
      router.push(`/calls?execution_id=${execution.execution_id}`);
    } catch {
      // Surfaced via placeCall.error below.
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      label="Place a call"
      className="max-w-xl p-0"
      header={
        <div className="flex items-center justify-between p-6 pb-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Single call
            </p>
            <h3 className="text-xl font-semibold tracking-tight text-foreground">Place call</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close place call dialog"
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      }
    >
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Agent</span>
            <select
              value={effectiveAgentId}
              onChange={(event) => setAgentOverride(event.target.value)}
              aria-label="Call agent"
              className={fieldStyles.field}
            >
              {(agents ?? []).map((agent) => (
                <option key={agent.agent_id} value={agent.agent_id}>
                  {agent.agent_name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Dialing</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value as "simulated" | "talko")}
              aria-label="Call provider"
              className={fieldStyles.field}
            >
              <option value="simulated">Simulated (no real call)</option>
              <option value="talko">Talko trunk — real call</option>
            </select>
          </label>
        </div>

        {provider === "talko" && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Talko partner (credentials from DB)
            </span>
            <select
              value={partnerId}
              onChange={(event) => handlePartnerChange(event.target.value)}
              aria-label="Talko partner"
              className={fieldStyles.field}
            >
              <option value="">Manual — per-call key/DID below</option>
              {(partners ?? []).map((partner) => (
                <option key={partner.partner_id} value={partner.partner_id}>
                  {partner.display_name || `Partner ${partner.partner_id}`} ({partner.partner_id})
                  {partner.key_configured ? "" : " — no key"}
                </option>
              ))}
            </select>
          </label>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              To number
            </span>
            <input
              value={toNumber}
              onChange={(event) => setToNumber(event.target.value)}
              placeholder="+919800000001"
              inputMode="tel"
              autoComplete="off"
              className={fieldStyles.field}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Caller DID {selectedPartner && partnerDids.length > 0 ? "(from partner)" : "(optional)"}
            </span>
            {selectedPartner && partnerDids.length > 0 ? (
              <select
                value={fromNumber}
                onChange={(event) => setFromNumber(event.target.value)}
                aria-label="Caller DID"
                className={fieldStyles.field}
              >
                {partnerDids.map((did) => (
                  <option key={did} value={did}>
                    {did}
                    {did === selectedPartner.default_did ? " — default" : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                value={fromNumber}
                onChange={(event) => setFromNumber(event.target.value)}
                placeholder={selectedPartner ? "Partner default" : "Default from trunk"}
                inputMode="tel"
                autoComplete="off"
                className={fieldStyles.field}
              />
            )}
          </label>
        </div>

        {provider === "talko" && !partnerId && (
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Talko API key (optional)
            </span>
            <input
              type="password"
              value={talkoApiKey}
              onChange={(event) => setTalkoApiKey(event.target.value)}
              placeholder="tkp_live_…"
              autoComplete="off"
              className={fieldStyles.field}
            />
          </label>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Variables (JSON)
            </span>
            <button
              type="button"
              onClick={() => setVariablesRaw(FEE_DEMO_VARIABLES)}
              className="text-xs font-mono text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
            >
              Fill fee-demo preset
            </button>
          </div>
          <textarea
            value={variablesRaw}
            onChange={(event) => setVariablesRaw(event.target.value)}
            rows={6}
            spellCheck={false}
            aria-label="Call variables JSON"
            className={cn(fieldStyles.field, "font-mono text-xs min-h-28")}
          />
          {!parsed.ok && (
            <p role="alert" className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
              <AlertCircle className="w-4 h-4 shrink-0" /> {parsed.error}
            </p>
          )}
        </div>

        {placeCall.isError && (
          <p role="alert" className="flex items-center gap-2 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4 shrink-0" />{" "}
            {placeCall.error instanceof Error && placeCall.error.message
              ? placeCall.error.message
              : "Failed to place the call. Check the backend and retry."}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          title={canWrite ? undefined : `Requires ${minRoleFor("calls.simulate")} role`}
          className="w-full h-12 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm transition-all hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
        >
          {placeCall.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <PhoneCall className="w-4 h-4" />
          )}
          Place call
        </button>
      </div>
    </Modal>
  );
}
