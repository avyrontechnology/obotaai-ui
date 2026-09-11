"use client";

import { useState } from "react";
import { AlertCircle, BellRing, Check, Loader2, Mail, Plug2, SlidersHorizontal } from "lucide-react";
import { useOrganization, useUpdateOrganization } from "@/services/platform/organization";
import type { NotificationPrefs } from "@/lib/schemas/platform";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";


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
    <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border min-w-0">
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-sm font-medium text-foreground truncate">{label}</span>
        {description && <span className="text-xs text-muted-foreground truncate" title={description}>{description}</span>}
      </div>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </div>
  );
}

function NotificationsStats({ prefs, loading }: { prefs: NotificationPrefs | null; loading: boolean }) {
  const eventsOn = prefs ? [prefs.low_balance_enabled, prefs.call_failed_enabled, prefs.batch_completed_enabled].filter(Boolean).length : 0;
  const channelsOn = prefs ? [prefs.channel_email, prefs.channel_webhook].filter(Boolean).length : 0;
  return (
    <SettingsStatsGrid label="Notification summary">
      <SettingsStatCard
        title="Events on"
        icon={BellRing}
        value={loading || !prefs ? "—" : `${eventsOn}/3`}
        caption={loading ? "Loading" : "Low balance · failed · batch"}
        loading={loading}
        delay={0}
      />
      <SettingsStatCard
        title="Channels on"
        icon={Plug2}
        value={loading || !prefs ? "—" : `${channelsOn}/2`}
        caption={loading ? "Loading" : "Email · webhooks"}
        loading={loading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Low threshold"
        icon={SlidersHorizontal}
        value={loading || !prefs ? "—" : prefs.low_balance_enabled ? `${prefs.low_balance_threshold.toLocaleString()}` : "—"}
        caption={loading ? "Loading" : prefs?.low_balance_enabled ? "Credits floor" : "Alert off"}
        loading={loading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Email to"
        icon={Mail}
        value={loading || !prefs ? "—" : prefs.channel_email ? "On" : "Off"}
        caption={loading ? "Loading" : "Support inbox route"}
        loading={loading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

export function OrgNotifications() {
  const { data: org, isLoading } = useOrganization();
  const updateOrg = useUpdateOrganization();

  const [draft, setDraft] = useState<Partial<NotificationPrefs> | null>(null);
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
        <div className="h-64 rounded-3xl bg-card border border-border animate-pulse motion-reduce:animate-none" />
      </div>
    );
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
    <div className="space-y-6 min-w-0">
      <NotificationsStats prefs={prefs} loading={false} />

      <section className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0">
        <SectionHeader
          title="Notifications"
          description="What fires, and where it goes."
          className="mb-6"
        />

        <div className="space-y-3 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Events</p>
          <LabeledToggle
            checked={prefs.low_balance_enabled}
            onChange={(value) => patch({ low_balance_enabled: value })}
            label="Low balance alert"
            description="Warn when credits drop below the threshold"
          />
          {prefs.low_balance_enabled && (
            <div className="flex flex-wrap items-center gap-3 pl-1 min-w-0">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Below</span>
              <input
                value={String(prefs.low_balance_threshold)}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  if (Number.isFinite(value) && value >= 0) patch({ low_balance_threshold: value });
                }}
                inputMode="decimal"
                aria-label="Low balance threshold"
                className={cn(fieldStyles.fieldMuted, "max-w-[140px] font-mono tabular-nums")}
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

        <div className="space-y-3 mt-6 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Channels</p>
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

        <div className="flex flex-wrap items-center gap-3 mt-5">
          <button
            onClick={() => void handleSave().catch(() => undefined)}
            disabled={!dirty || updateOrg.isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
          >
            {updateOrg.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save Notifications
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

      <p className="text-xs font-mono text-muted-foreground tabular-nums truncate" title={`Email routes to ${org.support_email}`}>
        Email routes to {org.support_email} · Webhooks reuse agent endpoints.
      </p>
    </div>
  );
}
