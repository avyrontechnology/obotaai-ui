"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2, X } from "lucide-react";
import { useOrganization, useUpdateOrganization } from "@/services/platform/organization";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


const RESIDENCIES = [
  { value: "in", label: "India" },
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
] as const;

export function OrgSecurity() {
  const { data: org, isLoading } = useOrganization();
  const updateOrg = useUpdateOrganization();

  const [residency, setResidency] = useState<string | null>(null);
  const [timeout, setTimeout] = useState<string | null>(null);
  const [allowlist, setAllowlist] = useState<string[] | null>(null);
  const [ipDraft, setIpDraft] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading || !org) {
    return <div className="h-48 rounded-3xl bg-card border border-border animate-pulse" />;
  }

  const residencyValue = residency ?? org.data_residency;
  const timeoutValue = timeout ?? String(org.session_timeout_mins);
  const allowlistValue = allowlist ?? org.ip_allowlist;
  const dirty =
    residencyValue !== org.data_residency ||
    timeoutValue !== String(org.session_timeout_mins) ||
    JSON.stringify(allowlistValue) !== JSON.stringify(org.ip_allowlist);

  const handleSave = async () => {
    setSaveError(null);
    setSavedFlash(false);
    const minutes = Number(timeoutValue);
    if (!Number.isInteger(minutes) || minutes < 5 || minutes > 480) {
      setSaveError("Session timeout must be 5–480 minutes.");
      return;
    }
    try {
      await updateOrg.mutateAsync({
        data_residency: residencyValue as "in" | "us" | "eu",
        session_timeout_mins: minutes,
        ip_allowlist: allowlistValue,
      });
      setResidency(null);
      setTimeout(null);
      setAllowlist(null);
      setSavedFlash(true);
    } catch {
      setSaveError("Save failed. Check the values and retry.");
    }
  };

  const addIp = () => {
    const value = ipDraft.trim();
    if (!value || allowlistValue.includes(value)) return;
    setAllowlist([...allowlistValue, value]);
    setIpDraft("");
    setSavedFlash(false);
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-foreground">Security</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Stored preferences. Enforcement for these controls ships with the auth milestone.
        </p>
      </div>

      <div className="grid gap-6">
        <div className="space-y-2">
          <label htmlFor="data-residency" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Data Residency
          </label>
          <select
            id="data-residency"
            value={residencyValue}
            onChange={(event) => {
              setResidency(event.target.value);
              setSavedFlash(false);
            }}
            className={fieldStyles.fieldMuted}
          >
            {RESIDENCIES.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label htmlFor="session-timeout" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Session Timeout (minutes)
          </label>
          <input
            id="session-timeout"
            inputMode="numeric"
            value={timeoutValue}
            onChange={(event) => {
              setTimeout(event.target.value);
              setSavedFlash(false);
            }}
            className={fieldStyles.fieldMuted}
          />
        </div>

        <div className="space-y-2">
          <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">IP Allowlist</span>
          <div className="flex flex-wrap gap-2">
            {allowlistValue.length === 0 && (
              <p className="text-sm text-muted-foreground">Empty — all IPs currently allowed.</p>
            )}
            {allowlistValue.map((entry) => (
              <span
                key={entry}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted font-mono text-xs text-foreground border border-border"
              >
                {entry}
                <button
                  onClick={() => {
                    setAllowlist(allowlistValue.filter((item) => item !== entry));
                    setSavedFlash(false);
                  }}
                  aria-label={`Remove ${entry}`}
                  className="hover:text-red-600 dark:hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={ipDraft}
              onChange={(event) => setIpDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addIp();
                }
              }}
              placeholder="10.0.0.0/8"
              aria-label="IP or CIDR to allow"
              className={cn(fieldStyles.fieldMuted, "font-mono")}
            />
            <button
              onClick={addIp}
              className="h-12 px-5 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleSave().catch(() => undefined)}
          disabled={!dirty || updateOrg.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {updateOrg.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Security
        </button>
        {savedFlash && !dirty && (
          <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
            <Check className="w-4 h-4" /> Saved
          </span>
        )}
        {saveError && (
          <span className="flex items-center gap-1.5 text-sm text-red-700 dark:text-red-400">
            <AlertCircle className="w-4 h-4" /> {saveError}
          </span>
        )}
      </div>
    </div>
  );
}
