"use client";

import { useState } from "react";
import { AlertCircle, Check, KeyRound, Loader2, ScrollText, X } from "lucide-react";
import { useOrganization, useUpdateOrganization } from "@/services/platform/organization";
import { useAuthEvents, useChangePassword } from "@/services/auth";
import { useCan } from "@/lib/rbac";
import { timeAgo } from "@/lib/format";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


const RESIDENCIES = [
  { value: "in", label: "India" },
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
] as const;

function PasswordSection() {
  const changePassword = useChangePassword();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    setDone(false);
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    try {
      await changePassword.mutateAsync({ current_password: current, new_password: next, confirm });
      setCurrent("");
      setNext("");
      setConfirm("");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Password change failed.");
    }
  };

  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium text-foreground">Change password</h4>
      </div>
      <p className="text-xs text-muted-foreground">Other sessions are signed out, this one stays.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          aria-label="Current password"
          className={fieldStyles.fieldSm}
        />
        <input
          value={next}
          onChange={(event) => setNext(event.target.value)}
          type="password"
          autoComplete="new-password"
          placeholder="New password (8+)"
          aria-label="New password"
          className={fieldStyles.fieldSm}
        />
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          type="password"
          autoComplete="new-password"
          placeholder="Repeat new password"
          aria-label="Confirm new password"
          className={cn(fieldStyles.fieldSm)}
        />
      </div>
      {error && <p className="text-xs text-red-700 dark:text-red-400">{error}</p>}
      {done && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <Check className="w-3.5 h-3.5" /> Password updated.
        </p>
      )}
      <button
        onClick={() => void handleSave()}
        disabled={changePassword.isPending}
        className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
      >
        {changePassword.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        Update password
      </button>
    </div>
  );
}

function AuditSection() {
  const canView = useCan("team.manage");
  const { data: events, isLoading } = useAuthEvents(canView);
  if (!canView) return null;
  return (
    <div className="rounded-3xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center gap-2">
        <ScrollText className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium text-foreground">Audit trail</h4>
      </div>
      {isLoading ? (
        <div className="h-20 rounded-2xl bg-muted/50 animate-pulse" />
      ) : (events ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No auth events yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1">
          {(events ?? []).map((event) => (
            <li
              key={event.event_id}
              className="flex items-center gap-2 text-xs font-mono text-muted-foreground"
            >
              <span className="shrink-0">{timeAgo(event.created_at)}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted text-foreground shrink-0">{event.type}</span>
              <span className="truncate">{event.email ?? event.detail ?? ""}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

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
          Sessions ride httpOnly cookies and expire server-side. Sign out anywhere to revoke instantly.
        </p>
      </div>

      <PasswordSection />
      <AuditSection />

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
