"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useOrganization, useResetWorkspace, useUpdateOrganization } from "@/services/platform/organization";
import { minRoleFor, useCan } from "@/lib/rbac";
import { fieldStyles } from "@/lib/field-styles";


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
      <div className="space-y-6">
        <div className="h-32 rounded-3xl bg-card border border-border animate-pulse" />
        <div className="h-32 rounded-3xl bg-card border border-border animate-pulse" />
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
    <div className="space-y-12">
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-foreground">Organization Profile</h3>
          <p className="text-sm text-muted-foreground mt-1">Saved to the platform on every change.</p>
        </div>

        <div className="grid gap-6">
          <div className="space-y-2">
            <label htmlFor="org-name" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
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

          <div className="space-y-2">
            <label htmlFor="org-email" className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
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

        <div className="flex items-center gap-3">
          <button
            onClick={() => void handleSave().catch(() => undefined)}
            disabled={!dirty || updateOrg.isPending || !canWriteSettings}
            title={canWriteSettings ? undefined : `Requires ${minRoleFor("settings.write")} role`}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {updateOrg.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Save Profile
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

      <div className="w-full h-px bg-border" />

      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium text-red-600 dark:text-red-500">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mt-1">Irreversible workspace actions.</p>
        </div>

        <div className="p-6 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/20 rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h4 className="font-medium text-red-900 dark:text-red-200">Reset Workspace</h4>
            <p className="text-sm text-red-700/70 dark:text-red-400/70 mt-1 max-w-sm">
              Permanently clears agents-adjacent platform data: executions, batches, campaigns, wallet, numbers and
              integrations. Organization profile survives.
            </p>
            {resetSummary && <p className="text-sm text-red-700 dark:text-red-300 mt-2">{resetSummary}</p>}
          </div>
          <button
            onClick={() => void handleReset().catch(() => undefined)}
            disabled={resetWorkspace.isPending || !canReset}
            title={canReset ? undefined : `Requires ${minRoleFor("workspace.reset")} role`}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-colors shadow-lg shadow-red-600/20 whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            {resetWorkspace.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmReset ? "Click again to confirm" : "Reset Workspace"}
          </button>
        </div>
      </div>
    </div>
  );
}
