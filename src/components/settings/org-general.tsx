"use client";

import { useState } from "react";
import { AlertCircle, Building2, Check, Globe2, Loader2, Lock, Timer, X } from "lucide-react";
import { useOrganization, useResetWorkspace, useUpdateOrganization } from "@/services/platform/organization";
import { minRoleFor, useCan } from "@/lib/rbac";
import { fieldStyles } from "@/lib/field-styles";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";

const RESIDENCY_LABELS: Record<string, string> = {
  in: "India",
  us: "United States",
  eu: "European Union",
};

function GeneralStats() {
  const { data: org, isLoading } = useOrganization();
  const name = org?.name ?? "—";
  const residency = org ? org.data_residency.toUpperCase() : "—";
  const residencyCaption = org ? (RESIDENCY_LABELS[org.data_residency] ?? org.data_residency) : "No residency data";
  const timeout = org ? `${org.session_timeout_mins}m` : "—";
  const allowlistCount = org ? String(org.ip_allowlist.length) : "—";
  const allowlistCaption =
    !org || isLoading
      ? "Loading allowlist"
      : org.ip_allowlist.length === 0
        ? "Open to all IPs"
        : `${org.ip_allowlist.length} ${org.ip_allowlist.length === 1 ? "entry" : "entries"} restricted`;
  return (
    <SettingsStatsGrid label="Organization summary">
      <SettingsStatCard
        title="Workspace"
        icon={Building2}
        value={isLoading ? "—" : name}
        caption={org ? `id ${org.org_id.slice(0, 8)}…` : "No organization data"}
        loading={isLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Data residency"
        icon={Globe2}
        value={isLoading ? "—" : residency}
        caption={isLoading ? "Loading" : residencyCaption}
        loading={isLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Session timeout"
        icon={Timer}
        value={isLoading ? "—" : timeout}
        caption={isLoading ? "Loading" : "Server-side expiry"}
        loading={isLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="IP allowlist"
        icon={Lock}
        value={isLoading ? "—" : allowlistCount}
        caption={allowlistCaption}
        loading={isLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

export function OrgGeneral() {
  const { data: org, isLoading } = useOrganization();
  const updateOrg = useUpdateOrganization();
  const resetWorkspace = useResetWorkspace();
  const canReset = useCan("workspace.reset");
  const canWriteSettings = useCan("settings.write");

  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetSummary, setResetSummary] = useState<string | null>(null);

  if (isLoading || !org) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[104px] rounded-3xl bg-card border border-border animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
        <div className="h-32 rounded-3xl bg-card border border-border animate-pulse motion-reduce:animate-none" />
        <div className="h-32 rounded-3xl bg-card border border-border animate-pulse motion-reduce:animate-none" />
      </div>
    );
  }

  const nameValue = name ?? org.name;
  const emailValue = email ?? org.support_email;
  const dirty = nameValue !== org.name || emailValue !== org.support_email;

  const handleSave = async () => {
    setSaveError(null);
    setSavedFlash(false);
    try {
      await updateOrg.mutateAsync({ name: nameValue.trim(), support_email: emailValue.trim() });
      setName(null);
      setEmail(null);
      setSavedFlash(true);
    } catch {
      setSaveError("Save failed. Check the values and retry.");
    }
  };

  const handleReset = async () => {
    if (!confirmReset) {
      setConfirmReset(true);
      return;
    }
    try {
      const result = await resetWorkspace.mutateAsync();
      const total = Object.values(result.cleared).reduce((sum, count) => sum + count, 0);
      setResetSummary(`Workspace cleared — ${total} records removed across all modules.`);
      setConfirmReset(false);
    } catch {
      setSaveError("Reset failed. Is the backend running?");
      setConfirmReset(false);
    }
  };

  return (
    <div className="space-y-6 min-w-0">
      <GeneralStats />

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Organization Profile"
          description="Saved to the platform on every change."
          className="mb-6"
        />

        <div className="grid gap-4 min-w-0">
          <div className="space-y-2 min-w-0">
            <label htmlFor="org-name" className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Organization Name
            </label>
            <input
              id="org-name"
              type="text"
              value={nameValue}
              onChange={(event) => {
                setName(event.target.value);
                setSavedFlash(false);
              }}
              className={fieldStyles.fieldMuted}
            />
          </div>

          <div className="space-y-2 min-w-0">
            <label htmlFor="org-email" className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              Support Email
            </label>
            <input
              id="org-email"
              type="email"
              value={emailValue}
              onChange={(event) => {
                setEmail(event.target.value);
                setSavedFlash(false);
              }}
              className={fieldStyles.fieldMuted}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            onClick={() => void handleSave().catch(() => undefined)}
            disabled={!dirty || updateOrg.isPending || !canWriteSettings}
            title={canWriteSettings ? undefined : `Requires ${minRoleFor("settings.write")} role`}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            {updateOrg.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save Profile
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

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <h2 className="text-lg font-semibold tracking-tight text-foreground mb-1">Danger Zone</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Irreversible workspace actions. Organization profile survives.
          {!canReset && ` Requires ${minRoleFor("workspace.reset")} role.`}
        </p>
        {!canReset ? (
          <p className="text-sm text-muted-foreground rounded-2xl border border-dashed border-border p-4">
            Read-only for your role.
          </p>
        ) : (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 min-w-0">
            <div className="min-w-0">
              <h3 className="font-medium text-foreground truncate" title="Reset Workspace">Reset Workspace</h3>
              <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                Permanently clears agents-adjacent platform data: executions, batches, campaigns, wallet, numbers and
                integrations.
              </p>
              {resetSummary && <p className="text-sm text-muted-foreground mt-2">{resetSummary}</p>}
            </div>
            {!confirmReset ? (
              <button
                onClick={() => void handleReset().catch(() => undefined)}
                disabled={resetWorkspace.isPending}
                className="flex items-center gap-2 px-5 h-11 rounded-2xl bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20 text-sm font-semibold hover:bg-red-500/20 disabled:opacity-50 transition-colors duration-200 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
              >
                {resetWorkspace.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Reset Workspace
              </button>
            ) : (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => void handleReset().catch(() => undefined)}
                  disabled={resetWorkspace.isPending}
                  className="flex items-center gap-2 px-5 h-11 rounded-2xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors duration-200 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60 motion-reduce:transition-none"
                >
                  {resetWorkspace.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  ) : (
                    <Check className="w-4 h-4" aria-hidden="true" />
                  )}
                  Confirm reset
                </button>
                <button
                  onClick={() => setConfirmReset(false)}
                  aria-label="Cancel reset"
                  className="h-11 w-11 flex items-center justify-center rounded-2xl bg-muted text-muted-foreground hover:text-foreground transition-colors duration-200 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <p className="text-xs font-mono text-muted-foreground tabular-nums truncate" title="PUT /organization">
        Profile writes PUT /organization · Reset clears platform data, profile survives.
      </p>
    </div>
  );
}
