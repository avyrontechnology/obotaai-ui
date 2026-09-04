"use client";

import { useMemo, useState } from "react";
import { AlertCircle, ArrowDownLeft, ArrowUpRight, Loader2, Wallet } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { notify } from "@/lib/notify";
import { useTopUpWallet, useWallet, useWalletLedger } from "@/services/platform/wallet";
import { cn } from "@/lib/utils";

const PRESETS = [10, 50, 100, 500];

type LedgerFilter = "all" | "topup" | "debit";

export function OrgBilling() {
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const [filter, setFilter] = useState<LedgerFilter>("all");
  const { data: entries, isLoading: ledgerLoading } = useWalletLedger(
    50,
    filter === "all" ? undefined : filter
  );
  const topUp = useTopUpWallet();

  const [customAmount, setCustomAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let topped = 0;
    let spent = 0;
    (entries ?? []).forEach((entry) => {
      if (entry.type === "topup") topped += entry.amount_credits;
      else spent += entry.amount_credits;
    });
    return { topped, spent };
  }, [entries]);

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

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-medium text-foreground">Billing & Credits</h3>
        <p className="text-sm text-muted-foreground mt-1">Wallet balance, top-ups and usage ledger.</p>
      </div>

      <div className="p-6 rounded-3xl bg-card border border-border">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-ember-700 dark:text-ember-300" />
          </div>
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Balance</p>
        </div>
        <p className="text-4xl font-semibold tracking-tight text-foreground mt-2">
          {walletLoading ? "—" : `${(wallet?.balance_credits ?? 0).toLocaleString()} credits`}
        </p>
        <div className="flex gap-4 mt-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            +{totals.topped.toLocaleString()} in
          </span>
          <span className="inline-flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
            −{totals.spent.toLocaleString()} out
          </span>
        </div>
      </div>

      <div className="space-y-3">
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Top up</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((amount) => (
            <button
              key={amount}
              onClick={() => void handleTopUp(amount).catch(() => undefined)}
              disabled={topUp.isPending}
              className="h-11 px-5 rounded-2xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {topUp.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              +{amount}
            </button>
          ))}
          <div className="flex gap-2">
            <input
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handleTopUp(Number(customAmount)).catch(() => undefined);
                }
              }}
              placeholder="Custom"
              inputMode="decimal"
              aria-label="Custom top-up amount"
              className="h-11 w-28 px-4 bg-muted/50 border border-border rounded-2xl text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ember-400/50"
            />
            <button
              onClick={() => void handleTopUp(Number(customAmount)).catch(() => undefined)}
              disabled={topUp.isPending}
              className="h-11 px-4 rounded-2xl border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 disabled:opacity-50 transition-colors"
            >
              Add
            </button>
          </div>
        </div>
        {error && (
          <p className="flex items-center gap-2 text-xs text-red-700 dark:text-red-400">
            <AlertCircle className="w-3.5 h-3.5" /> {error}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">Ledger</p>
          <div className="flex gap-1.5">
            {(["all", "topup", "debit"] as const).map((option) => (
              <button
                key={option}
                onClick={() => setFilter(option)}
                className={cn(
                  "px-3 h-8 rounded-full text-xs font-mono border transition-colors capitalize",
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
          <div className="h-32 rounded-3xl bg-card border border-border animate-pulse" />
        ) : (entries ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground rounded-3xl border border-dashed border-border p-8 text-center">
            No ledger entries yet. Top up to get started.
          </p>
        ) : (
          <div className="rounded-3xl border border-border overflow-hidden">
            {(entries ?? []).map((entry, index) => (
              <div
                key={entry.entry_id}
                className={cn(
                  "flex items-center justify-between gap-4 px-5 py-3.5 bg-card text-sm",
                  index > 0 && "border-t border-border"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                      entry.type === "topup"
                        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                        : "bg-rose-500/10 text-rose-700 dark:text-rose-400"
                    )}
                  >
                    {entry.type === "topup" ? (
                      <ArrowDownLeft className="w-4 h-4" />
                    ) : (
                      <ArrowUpRight className="w-4 h-4" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p className="text-foreground truncate">{entry.reason || entry.type}</p>
                    <p className="text-xs text-muted-foreground">{timeAgo(entry.created_at)}</p>
                  </div>
                </div>
                <span
                  className={cn(
                    "font-mono text-sm shrink-0",
                    entry.type === "topup"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-foreground"
                  )}
                >
                  {entry.type === "topup" ? "+" : "−"}
                  {entry.amount_credits.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
