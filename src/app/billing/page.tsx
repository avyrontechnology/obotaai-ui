"use client";

import { OrgBilling } from "@/components/settings/org-billing";
import { PageHeader } from "@/components/common/page-header";
import { timeAgo } from "@/lib/format";
import { useOrganization } from "@/services/platform/organization";
import { useWallet } from "@/services/platform/wallet";

export default function BillingPage() {
  // Header honesty: badge = real wallet balance (useWallet); threshold chip =
  // real org notifications prefs (useOrganization). Both show "—" while
  // loading, never invented.
  const { data: wallet, isLoading: walletLoading } = useWallet();
  const { data: org, isLoading: orgLoading } = useOrganization();

  const balanceBadge =
    walletLoading || !wallet ? "— credits" : `${wallet.balance_credits.toLocaleString()} credits`;
  const balanceTitle =
    walletLoading || !wallet
      ? "Loading balance"
      : `${wallet.balance_credits.toLocaleString()} ${wallet.currency}`;

  const thresholdLabel = orgLoading || !org
    ? "—"
    : org.notifications.low_balance_enabled
      ? `alert < ${org.notifications.low_balance_threshold.toLocaleString()} credits`
      : "alert off";
  const thresholdTitle = orgLoading || !org
    ? "Loading low-balance alert"
    : org.notifications.low_balance_enabled
      ? `Low-balance alert below ${org.notifications.low_balance_threshold.toLocaleString()} credits`
      : "Low-balance alert off";

  const updatedLabel =
    walletLoading || !wallet ? "—" : `updated ${timeAgo(wallet.updated_at)}`;
  const updatedTitle = wallet?.updated_at ?? "Loading balance";

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8">
      <PageHeader
        title={
          <>
            <span className="truncate">Billing</span>
            <span
              className="font-mono text-xs font-normal tracking-normal px-2.5 py-1 rounded-full border border-border bg-muted/50 text-muted-foreground shrink-0 tabular-nums truncate max-w-full"
              title={balanceTitle}
            >
              {balanceBadge}
            </span>
          </>
        }
        description="Wallet balance, top-ups and spend ledger — totals reflect the loaded view."
        actions={
          <>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground font-mono text-xs uppercase tracking-widest shrink-0 max-w-full"
              title={thresholdTitle}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
              <span className="truncate tabular-nums">{thresholdLabel}</span>
            </span>
            <span
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-muted/50 text-muted-foreground font-mono text-xs uppercase tracking-widest shrink-0 max-w-full"
              title={updatedTitle}
            >
              <span className="truncate tabular-nums">{updatedLabel}</span>
            </span>
          </>
        }
      />
      <OrgBilling />
    </div>
  );
}
