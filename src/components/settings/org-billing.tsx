"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  BellRing,
  Check,
  History,
  Loader2,
  PiggyBank,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { timeAgo } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useTopUpWallet, useWallet, useWalletLedger } from "@/services/platform/wallet";
import {
  useOrganization,
  useUpdateOrganization,
} from "@/services/platform/organization";
import type { NotificationPrefs } from "@/lib/schemas/platform";
import { Toggle } from "@/components/common/toggle";
import { fieldStyles } from "@/lib/field-styles";
import { cn } from "@/lib/utils";
import { SectionHeader } from "@/components/common/section-header";
import { SettingsStatCard, SettingsStatsGrid } from "@/components/settings/settings-stats";

const PRESETS = [10, 50, 100, 500];

type LedgerFilter = "all" | "topup" | "debit";

// No destructive actions here — top-up is additive and threshold saves are
// reversible, so no two-step confirm (agents delete pattern) is required.
// Mutations, endpoints and RBAC are unchanged from the previous version:
// visuals only, every number comes from hooks, "—" while loading.

function BillingStats({ filter }: { filter: LedgerFilter }) {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: entries, isLoading: ledgerLoading } = useWalletLedger(
    50,
    filter === "all" ? undefined : filter
  );
  const totals = useMemo(() => {
    let topped = 0;
    let spent = 0;
    let topupCount = 0;
    (entries ?? []).forEach((entry) => {
      if (entry.type === "topup") {
        topped += entry.amount_credits;
        topupCount += 1;
      } else spent += entry.amount_credits;
    });
    return { topped, spent, topupCount, count: (entries ?? []).length };
  }, [entries]);
  const balance = wallet ? `${wallet.balance_credits.toLocaleString()} credits` : "—";
  return (
    <SettingsStatsGrid label="Billing summary">
      <SettingsStatCard
        title="Balance"
        icon={Wallet}
        value={walletLoading ? "—" : balance}
        caption={walletLoading ? "Loading" : `${wallet?.currency ?? "credits"} · updated ${wallet ? timeAgo(wallet.updated_at) : "—"}`}
        loading={walletLoading}
        delay={0}
      />
      <SettingsStatCard
        title="Spend · loaded"
        icon={ArrowUpRight}
        value={ledgerLoading ? "—" : `−${totals.spent.toLocaleString()}`}
        caption={ledgerLoading ? "Loading" : `${totals.count} entries in view`}
        loading={ledgerLoading}
        delay={0.05}
      />
      <SettingsStatCard
        title="Topped · loaded"
        icon={ArrowDownLeft}
        value={ledgerLoading ? "—" : `+${totals.topped.toLocaleString()}`}
        caption={ledgerLoading ? "Loading" : "Sum of top-ups in view"}
        loading={ledgerLoading}
        delay={0.1}
      />
      <SettingsStatCard
        title="Top-up count"
        icon={PiggyBank}
        value={ledgerLoading ? "—" : String(totals.topupCount)}
        caption={ledgerLoading ? "Loading" : "Top-ups in loaded ledger"}
        loading={ledgerLoading}
        delay={0.15}
      />
    </SettingsStatsGrid>
  );
}

export function OrgBilling() {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const { data: entries, isLoading: ledgerLoading } = useWalletLedger(
    50,
    filter === "all" ? undefined : filter
  );
  const topUp = useTopUpWallet();

  const { data: org, isLoading: orgLoading } = useOrganization();
  const updateOrg = useUpdateOrganization();

  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [thresholdDraft, setThresholdDraft] = useState<Partial<NotificationPrefs> | null>(null);
  const [thresholdSaved, setThresholdSaved] = useState(false);
  const [thresholdError, setThresholdError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let topped = 0;
    let spent = 0;
    (entries ?? []).forEach((entry) => {
      if (entry.type === "topup") topped += entry.amount_credits;
      else spent += entry.amount_credits;
    });
    return { topped, spent };
  }, [entries]);

  const prefs: NotificationPrefs | null = org
    ? { ...org.notifications, ...(thresholdDraft ?? {}) }
    : null;
  const thresholdDirty =
    org && prefs ? JSON.stringify(prefs) !== JSON.stringify(org.notifications) : false;

  const patchThreshold = (update: Partial<NotificationPrefs>) => {
    setThresholdDraft((prev) => ({ ...(prev ?? {}), ...update }));
    setThresholdSaved(false);
  };

  const handleTopUp = async (amount: number) => {
    setError(null);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    try {
      await topUp.mutateAsync({ amount_credits: amount, reason: "manual top-up" });
      notify.success(`Added ${amount} credits`);
      setCustomAmount("");
    } catch {
      setError("Top-up failed. Is the backend running?");
    }
  };

  const handleSaveThreshold = async () => {
    if (!prefs) return;
    setThresholdError(null);
    setThresholdSaved(false);
    try {
      await updateOrg.mutateAsync({ notifications: prefs });
      setThresholdDraft(null);
      setThresholdSaved(true);
    } catch {
      setThresholdError("Save failed. Check the values and retry.");
    }
  };

  const thresholdStatus = orgLoading || !prefs
    ? "—"
    : prefs.low_balance_enabled
      ? `Alert below ${prefs.low_balance_threshold.toLocaleString()} credits`
      : "Low-balance alert off";
  const thresholdStatusTitle = orgLoading || !prefs
    ? "Loading low-balance alert"
    : prefs.low_balance_enabled
      ? `Low-balance alert below ${prefs.low_balance_threshold.toLocaleString()} credits`
      : "Low-balance alert off";

  const filterEmptyLabel = filter === "topup" ? "Top-ups" : "Spend";

  return (
    <div className="space-y-6 min-w-0">
      <BillingStats filter={filter} />

      <section
        aria-label="Balance and top-up"
        className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0"
      >
        <SectionHeader
          title="Balance & Top-up"
          description="Wallet balance and manual top-ups. Totals reflect the loaded ledger view."
          className="mb-6"
        />

        <div className="p-5 md:p-6 rounded-3xl bg-muted/40 border border-border min-w-0">
          <div className="flex items-center gap-3 mb-1 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Wallet className="w-4 h-4 text-ember-700 dark:text-ember-300" aria-hidden="true" />
            </div>
            <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground truncate">
              Balance
            </p>
          </div>
          <p
            className="text-3xl md:text-4xl font-semibold tracking-tight text-foreground mt-2 break-words tabular-nums"
            title={wallet ? `${wallet.balance_credits.toLocaleString()} ${wallet.currency}` : "Loading balance"}
          >
            {walletLoading ? "—" : `${(wallet?.balance_credits ?? 0).toLocaleString()} credits`}
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 text-xs text-muted-foreground tabular-nums min-w-0">
            <span
              className="inline-flex items-center gap-1 min-w-0 max-w-full"
              title={`+${totals.topped.toLocaleString()} credits in, loaded view`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
              <span className="truncate">+{totals.topped.toLocaleString()} in</span>
            </span>
            <span
              className="inline-flex items-center gap-1 min-w-0 max-w-full"
              title={`−${totals.spent.toLocaleString()} credits out, loaded view`}
            >
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400 shrink-0" aria-hidden="true" />
              <span className="truncate">−{totals.spent.toLocaleString()} out</span>
            </span>
          </div>
          <p
            className="flex items-center gap-1.5 mt-3 text-xs text-muted-foreground tabular-nums min-w-0"
            title={thresholdStatusTitle}
          >
            <BellRing className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{thresholdStatus}</span>
          </p>
        </div>

        <div className="space-y-3 mt-6 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">Top up</p>
          <div className="flex flex-wrap gap-2 min-w-0">
            {PRESETS.map((amount) => (
              <button
                key={amount}
                onClick={() => void handleTopUp(amount).catch(() => undefined)}
                disabled={topUp.isPending}
                title={`Top up ${amount} credits`}
                aria-label={`Top up ${amount} credits`}
                className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2 tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {topUp.isPending && <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                +{amount}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto min-w-0">
            <input
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleTopUp(Number(customAmount)).catch(() => undefined);
                }
              }}
              placeholder="Custom amount"
              inputMode="decimal"
              aria-label="Custom top-up amount"
              className={cn(fieldStyles.field, "sm:max-w-[180px] font-mono tabular-nums min-w-0")}
            />
            <button
              onClick={() => void handleTopUp(Number(customAmount)).catch(() => undefined)}
              disabled={topUp.isPending}
              title="Add custom amount"
              className="h-11 px-6 rounded-2xl border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none w-full sm:w-auto shrink-0"
            >
              Add
            </button>
          </div>
          {error && (
            <p
              role="alert"
              className="flex items-center gap-2 text-xs text-destructive min-w-0"
              title={error}
            >
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
              <span className="truncate">{error}</span>
            </p>
          )}
        </div>
      </section>

      <section
        aria-label="Low-balance alert"
        className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0"
      >
        <SectionHeader
          title="Low-balance Alert"
          description="Warn when credits run low. Saved to the organization."
          className="mb-6"
        />
        {orgLoading || !prefs ? (
          <div
            aria-hidden="true"
            className="h-20 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none"
          />
        ) : (
          <div className="space-y-3 min-w-0">
            <div className="flex items-start justify-between gap-4 p-4 rounded-2xl bg-muted/50 border border-border min-w-0">
              <div className="flex flex-col gap-0.5 min-w-0">
                <span className="text-sm font-medium text-foreground truncate" title="Low balance alert">
                  Low balance alert
                </span>
                <span
                  className="text-xs text-muted-foreground truncate"
                  title="Warn when credits drop below the threshold"
                >
                  Warn when credits drop below the threshold
                </span>
              </div>
              <Toggle
                checked={prefs.low_balance_enabled}
                onChange={(value) => patchThreshold({ low_balance_enabled: value })}
                label="Low balance alert"
              />
            </div>
            {prefs.low_balance_enabled && (
              <div className="flex flex-wrap items-center gap-3 pl-1 min-w-0">
                <span className="text-sm text-muted-foreground whitespace-nowrap">Below</span>
                <input
                  value={String(prefs.low_balance_threshold)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    if (Number.isFinite(value) && value >= 0) patchThreshold({ low_balance_threshold: value });
                  }}
                  inputMode="decimal"
                  aria-label="Low balance threshold"
                  className={cn(fieldStyles.fieldMuted, "max-w-[140px] font-mono tabular-nums")}
                />
                <span className="text-sm text-muted-foreground">credits</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => void handleSaveThreshold().catch(() => undefined)}
                disabled={!thresholdDirty || updateOrg.isPending}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                {updateOrg.isPending && (
                  <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                )}
                Save Alert
              </button>
              {thresholdSaved && !thresholdDirty && (
                <span className="flex items-center gap-1.5 text-sm text-emerald-700 dark:text-emerald-400 min-w-0">
                  <Check className="w-4 h-4 shrink-0" aria-hidden="true" /> Saved
                </span>
              )}
              {thresholdError && (
                <span
                  className="flex items-center gap-1.5 text-sm text-destructive min-w-0"
                  title={thresholdError}
                >
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />{" "}
                  <span className="truncate">{thresholdError}</span>
                </span>
              )}
            </div>
          </div>
        )}
      </section>

      <section
        aria-label="Wallet ledger"
        className="rounded-3xl border border-border bg-card p-5 md:p-6 min-w-0"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 min-w-0">
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground inline-flex items-center gap-2 min-w-0">
            <ReceiptText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />{" "}
            <span className="truncate">Ledger · last 50</span>
          </p>
          <div className="flex flex-wrap gap-1.5 min-w-0" role="group" aria-label="Ledger filter">
            {(["all", "topup", "debit"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                aria-pressed={filter === option}
                title={option === "topup" ? "Show top-ups" : option === "debit" ? "Show spend" : "Show all entries"}
                className={cn(
                  "px-3 h-8 rounded-full text-xs font-mono border transition-colors capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none",
                  filter === option
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {option === "topup" ? "Top-ups" : option === "debit" ? "Spend" : "All"}
              </button>
            ))}
          </div>
        </div>
        {ledgerLoading ? (
          <div
            aria-hidden="true"
            className="h-32 rounded-3xl bg-muted/50 border border-border animate-pulse motion-reduce:animate-none"
          />
        ) : (entries ?? []).length === 0 ? (
          filter === "all" ? (
            <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-8 text-center">
              No ledger entries yet. Top up to get started.
            </p>
          ) : (
            <div className="rounded-3xl border border-dashed border-border p-8 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                No {filterEmptyLabel.toLowerCase()} in the loaded view.
              </p>
              <button
                onClick={() => setFilter("all")}
                className="px-4 h-9 rounded-xl text-xs font-mono border border-border text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/50 motion-reduce:transition-none"
              >
                Clear filter
              </button>
            </div>
          )
        ) : (
          <div className="min-w-0">
            <div className="hidden lg:grid lg:grid-cols-12 gap-3 px-5 py-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
              <div className="lg:col-span-7 truncate">Entry</div>
              <div className="lg:col-span-3 truncate">When</div>
              <div className="lg:col-span-2 text-right truncate">Amount</div>
            </div>
            <div className="rounded-3xl border border-border overflow-hidden min-w-0">
              {(entries ?? []).map((entry, index) => (
                <div
                  key={entry.entry_id}
                  className={cn(
                    "grid grid-cols-1 lg:grid-cols-12 gap-2 lg:gap-3 items-center px-5 py-3.5 bg-card text-sm min-w-0",
                    index > 0 && "border-t border-border"
                  )}
                >
                  <div className="lg:col-span-7 flex items-center gap-3 min-w-0">
                    <span
                      className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                        entry.type === "topup"
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                          : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                      )}
                      aria-hidden="true"
                    >
                      {entry.type === "topup" ? (
                        <ArrowDownLeft className="w-4 h-4" aria-hidden="true" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4" aria-hidden="true" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-foreground truncate" title={entry.reason || entry.type}>
                        {entry.reason || entry.type}
                      </p>
                      <span
                        className={cn(
                          "mt-1 inline-flex max-w-full px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider border truncate",
                          entry.type === "topup"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20"
                        )}
                        title={entry.type}
                      >
                        <span className="truncate">{entry.type === "topup" ? "Top-up" : "Spend"}</span>
                      </span>
                    </div>
                  </div>
                  <p
                    className="lg:col-span-3 text-xs text-muted-foreground tabular-nums truncate min-w-0"
                    title={entry.created_at}
                  >
                    <History className="w-3 h-3 inline mr-1 lg:hidden" aria-hidden="true" />
                    {timeAgo(entry.created_at)}
                  </p>
                  <span
                    className={cn(
                      "lg:col-span-2 font-mono text-sm shrink-0 tabular-nums lg:text-right truncate min-w-0",
                      entry.type === "topup"
                        ? "text-emerald-700 dark:text-emerald-400"
                        : "text-foreground"
                    )}
                    title={`${entry.type === "topup" ? "+" : "−"}${entry.amount_credits.toLocaleString()}`}
                  >
                    {entry.type === "topup" ? "+" : "−"}
                    {entry.amount_credits.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <p
        className="text-xs font-mono text-muted-foreground tabular-nums truncate"
        title="Ledger shows the 50 most recent entries"
      >
        Ledger shows the 50 most recent entries · Totals reflect the loaded view.
      </p>
    </div>
  );
}
