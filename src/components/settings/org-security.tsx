"use client";

import { useState } from "react";
import { AlertCircle, Check, Globe2, KeyRound, Loader2, Lock, ScrollText, Timer, X } from "lucide-react";
import { useOrganization, useUpdateOrganization } from "@/services/platform/organization";
import { useAuthEvents, useChangePassword } from "@/services/auth";
import { useCan } from "@/lib/rbac";
import { timeAgo } from "@/lib/format";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";


const RESIDENCIES = [
  { value: "in", label: "India" },
  { value: "us", label: "United States" },
  { value: "eu", label: "European Union" },
] as const;

function SecurityStats() {
  const { data: org, isLoading: orgLoading } = useOrganization();
  const canView = useCan("team.manage");
  const { data: events, isLoading: eventsLoading } = useAuthEvents(canView);
  const timeout = org ? `${org.session_timeout_mins}m` : "—";
  const allowlist = org ? String(org.ip_allowlist.length) : "—";
  const allowlistCaption =
    !org || orgLoading
      ? "Loading"
      : org.ip_allowlist.length === 0
        ? "Open to all IPs"
        : `${org.ip_allowlist.length} restricted`;
  return (
    <SettingsStatsGrid label="Security summary">
      <SettingsStatCard
        title="Session timeout"
        icon={Timer}
        value={orgLoading ? "—" : timeout}
        caption={orgLoading ? "Loading" : "Server-side expiry"}
        loading={orgLoading}
        delay={0}
      />
      <SettingsStatCard
        title="IP allowlist"
        icon={Lock}
        value={orgLoading ? "—" : allowlist}
        caption={allowlistCaption}
        loading={orgLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Auth events"
        icon={ScrollText}
        value={!canView ? "—" : eventsLoading ? "—" : String((events ?? []).length)}
        caption={!canView ? "Admins only" : eventsLoading ? "Loading" : "Audit trail entries"}
        loading={eventsLoading && canView}
        delay={0.1}
      />
      <SettingsStatCard
        title="Residency"
        icon={Globe2}
        value={orgLoading ? "—" : (org ? org.data_residency.toUpperCase() : "—")}
        caption={orgLoading ? "Loading" : (RESIDENCIES.find((r) => r.value === org?.data_residency)?.label ?? "—")}
        loading={orgLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

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
    <div className="rounded-3xl border border-border bg-card p-5 md:p-6 space-y-3 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <h4 className="font-medium text-foreground truncate">Change password</h4>
      </div>
      <p className="text-xs text-muted-foreground">Other sessions are signed out, this one stays.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 min-w-0">
        <input
          value={current}
          onChange={(event) => setCurrent(event.target.value)}
          type="password"
          autoComplete="current-password"
          placeholder="Current password"
          aria-label="Current password"
          className={cn(fieldStyles.fieldSm, "min-w-0")}
        />
        <input
          value={next}
          onChange={(event) => setNext(event.target.value)}
          type="password"
          autoComplete="new-password"
          placeholder="New password (8+)"
          aria-label="New password"
          className={cn(fieldStyles.fieldSm, "min-w-0")}
        />
        <input
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          type="password"
          autoComplete="new-password"
          placeholder="Repeat new password"
          aria-label="Confirm new password"
          className={cn(fieldStyles.fieldSm, "min-w-0")}
        />
      </div>
      {error && <p className="text-xs text-destructive truncate" title={error}>{error}</p>}
      {done && (
        <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
          <Check className="w-3.5 h-3.5 shrink-0" aria-hidden="true" /> Password updated.
        </p>
      )}
      <button
        onClick={() => void handleSave()}
        disabled={changePassword.isPending}
        className="h-10 px-5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
      >
        {changePassword.isPending && <Loader2 className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
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
    <div className="rounded-3xl border border-border bg-card p-5 md:p-6 space-y-3 min-w-0">
      <div className="flex items-center gap-2 min-w-0">
        <ScrollText className="w-4 h-4 text-muted-foreground shrink-0" aria-hidden="true" />
        <h4 className="font-medium text-foreground truncate">Audit trail</h4>
      </div>
      <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Auth events</p>
      {isLoading ? (
        <div className="h-20 rounded-2xl bg-muted/50 animate-pulse motion-reduce:animate-none" />
      ) : (events ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No auth events yet.</p>
      ) : (
        <ul className="space-y-1.5 max-h-64 overflow-y-auto custom-scrollbar pr-1 min-w-0">
          {(events ?? []).map((event) => (
            <li
              key={event.event_id}
              className="flex items-center gap-2 text-xs font-mono text-muted-foreground min-w-0"
              title={`${timeAgo(event.created_at)} · ${event.type} · ${event.email ?? event.detail ?? ""}`}
            >
              <span className="shrink-0 tabular-nums">{timeAgo(event.created_at)}</span>
              <span className="px-2 py-0.5 rounded-full bg-muted text-foreground shrink-0 truncate max-w-[140px]">{event.type}</span>
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
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[104px] rounded-3xl bg-card border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
        <div className="h-48 rounded-3xl bg-card border border-border animate-pulse motion-reduce:animate-none" />
      </div>
    );
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
    <div className="space-y-6 min-w-0">
      <SecurityStats />

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Security"
          description="Sessions ride httpOnly cookies and expire server-side. Sign out anywhere to revoke instantly."
          className="mb-6"
        />
        <div className="space-y-4 min-w-0">
          <PasswordSection />
          <AuditSection />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-4">Session policy</p>
        <div className="grid gap-4 min-w-0">
          <div className="space-y-2 min-w-0">
            <label htmlFor="data-residency" className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
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

          <div className="space-y-2 min-w-0">
            <label htmlFor="session-timeout" className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
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
              className={cn(fieldStyles.fieldMuted, "tabular-nums")}
            />
          </div>

          <div className="space-y-2 min-w-0">
            <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">IP Allowlist</span>
            <div className="flex flex-wrap gap-2 min-w-0">
              {allowlistValue.length === 0 && (
                <p className="text-sm text-muted-foreground">Empty — all IPs currently allowed.</p>
              )}
              {allowlistValue.map((entry) => (
                <span
                  key={entry}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted font-mono text-xs text-foreground border border-border max-w-full"
                  title={entry}
                >
                  <span className="truncate">{entry}</span>
                  <button
                    onClick={() => {
                      setAllowlist(allowlistValue.filter((item) => item !== entry));
                      setSavedFlash(false);
                    }}
                    aria-label={`Remove ${entry}`}
                    className="hover:text-red-600 dark:hover:text-red-400 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 rounded motion-reduce:transition-none"
                  >
                    <X className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2 min-w-0">
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
                className={cn(fieldStyles.fieldMuted, "font-mono min-w-0 flex-1")}
              />
              <button
                onClick={addIp}
                className="h-12 px-5 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                Add
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            onClick={() => void handleSave().catch(() => undefined)}
            disabled={!dirty || updateOrg.isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            {updateOrg.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save Security
          </button>
          {savedFlash && !dirty && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400">
              <Check className="w-4 h-4" aria-hidden="true" /> Saved
            </span>
          )}
          {saveError && (
            <span className="flex items-center gap-1.5 text-sm text-destructive min-w-0">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" /> <span className="truncate">{saveError}</span>
            </span>
          )}
        </div>
      </section>

      <p className="text-xs font-mono text-muted-foreground tabular-nums truncate" title="No live session list — password rotation signs other sessions out">
        No live session list — password rotation signs other sessions out.
      </p>
    </div>
  );
}
