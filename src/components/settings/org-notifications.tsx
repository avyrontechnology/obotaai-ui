"use client";

import { useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useOrganization, useUpdateOrganization } from "@/services/platform/organization";
import type { NotificationPrefs } from "@/lib/schemas/platform";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";


function LabeledToggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

export function OrgNotifications() {
  const { data: org, isLoading } = useOrganization();
  const updateOrg = useUpdateOrganization();

  const [draft, setDraft] = useState<Partial<NotificationPrefs> | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (isLoading || !org) {
    return <div className="h-64 rounded-3xl bg-card border border-border animate-pulse" />;
  }

  const prefs: NotificationPrefs = { ...org.notifications, ...(draft ?? {}) };
  const dirty = JSON.stringify(prefs) !== JSON.stringify(org.notifications);

  const patch = (update: Partial<NotificationPrefs>) => {
    setDraft((prev) => ({ ...(prev ?? {}), ...update }));
    setSavedFlash(false);
  };

  const handleSave = async () => {
    setSaveError(null);
    setSavedFlash(false);
    try {
      await updateOrg.mutateAsync({ notifications: prefs });
      setDraft(null);
      setSavedFlash(true);
    } catch {
      setSaveError("Save failed. Check the values and retry.");
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-foreground">Notifications</h3>
        <p className="text-sm text-muted-foreground mt-1">What fires, and where it goes.</p>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Events</p>
        <LabeledToggle
          checked={prefs.low_balance_enabled}
          onChange={(value) => patch({ low_balance_enabled: value })}
          label="Low balance alert"
          description="Warn when credits drop below the threshold"
        />
        {prefs.low_balance_enabled && (
          <div className="flex items-center gap-3 pl-1">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Below</span>
            <input
              value={String(prefs.low_balance_threshold)}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isFinite(value) && value >= 0) patch({ low_balance_threshold: value });
              }}
              inputMode="decimal"
              aria-label="Low balance threshold"
              className={cn(fieldStyles.fieldMuted, "max-w-[140px] font-mono")}
            />
            <span className="text-sm text-muted-foreground">credits</span>
          </div>
        )}
        <LabeledToggle
          checked={prefs.call_failed_enabled}
          onChange={(value) => patch({ call_failed_enabled: value })}
          label="Failed calls"
          description="Notify when a call ends failed, busy or unanswered"
        />
        <LabeledToggle
          checked={prefs.batch_completed_enabled}
          onChange={(value) => patch({ batch_completed_enabled: value })}
          label="Batch completed"
          description="Notify when a campaign finishes"
        />
      </div>

      <div className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Channels</p>
        <LabeledToggle
          checked={prefs.channel_email}
          onChange={(value) => patch({ channel_email: value })}
          label="Email"
          description={`Sent to ${org.support_email}`}
        />
        <LabeledToggle
          checked={prefs.channel_webhook}
          onChange={(value) => patch({ channel_webhook: value })}
          label="Webhooks"
          description="Delivered to agent webhook endpoints"
        />
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => void handleSave().catch(() => undefined)}
          disabled={!dirty || updateOrg.isPending}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {updateOrg.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save Notifications
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
