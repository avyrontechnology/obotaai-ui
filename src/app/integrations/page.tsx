"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Boxes, CalendarClock, LayoutGrid, Phone, PlugZap } from "lucide-react";
import { OrgIntegrations } from "@/components/settings/org-integrations";
import { OrgMcp } from "@/components/settings/org-mcp";
import { OrgTalkoPartners } from "@/components/settings/org-talko-partners";
import { IntegrationsHubStats } from "@/components/integrations/hub-stats";
import { PageHeader } from "@/components/common/page-header";
import { RouteLoader } from "@/components/common/route-loader";
import { OTHER_KINDS, PRODUCTIVITY_KINDS, TELEPHONY_KINDS } from "@/lib/integrations/catalog";
import type { IntegrationKind } from "@/lib/schemas/platform";
import { integrationKindSchema } from "@/lib/schemas/platform";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "all", label: "All", icon: LayoutGrid, href: "/integrations" },
  { id: "telephony", label: "Telephony", icon: Phone, href: "/integrations?tab=telephony" },
  {
    id: "productivity",
    label: "Productivity",
    icon: CalendarClock,
    href: "/integrations?tab=productivity",
  },
  { id: "developers", label: "MCP & Custom", icon: PlugZap, href: "/integrations?tab=developers" },
] as const;

type HubTab = (typeof TABS)[number]["id"];

function parseTab(raw: string | null): HubTab {
  return raw === "telephony" || raw === "productivity" || raw === "developers" ? raw : "all";
}

function parseConnectKind(raw: string | null): IntegrationKind | null {
  if (!raw) return null;
  const parsed = integrationKindSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function IntegrationsContent() {
  // Pure derivation from the URL — no setState in effect (lint-safe, Flows pattern).
  const searchParams = useSearchParams();
  const router = useRouter();
  const tab = parseTab(searchParams.get("tab"));
  const connectKind = parseConnectKind(searchParams.get("connect"));

  /** Arrow / Home / End move the tab selection, per the WAI-ARIA tabs pattern. */
  const onTablistKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const current = TABS.findIndex((option) => option.id === tab);
    if (current === -1) return;
    let next = current;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (current + 1) % TABS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (current - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;

    event.preventDefault();
    router.push(TABS[next].href);
    document.getElementById(`tab-${TABS[next].id}`)?.focus();
  };

  // Deep-link support: /numbers → /integrations?tab=telephony&connect=twilio
  // auto-opens the right ConfigModal via initialAddingKind.
  const telephonyConnect = tab === "telephony" ? connectKind : null;
  const allConnect = tab === "all" ? connectKind : null;

  return (
    <div className="flex flex-col flex-1 min-h-[100dvh] max-w-7xl mx-auto w-full pt-6 md:pt-8 pb-16 px-4 md:px-8 gap-6">
      <PageHeader
        title="Integrations"
        description="Connect once, use everywhere — telephony for calls, productivity for workflows, MCP for custom tools. Credentials stay vault-sealed."
      />

      <IntegrationsHubStats />

      {/* Roving-tabindex tablist: arrow keys move between tabs and activate
          (each tab is a real link, so Enter/middle-click still work). Without
          this, a screen reader enters tab mode and finds nothing to navigate
          to, because the panels below had no tabpanel role. */}
      <div
        className="flex flex-wrap items-center gap-2"
        role="tablist"
        aria-label="Integration categories"
        onKeyDown={onTablistKeyDown}
      >
        {TABS.map((option) => (
          <Link
            key={option.id}
            href={option.href}
            id={`tab-${option.id}`}
            role="tab"
            aria-selected={tab === option.id}
            aria-controls={`panel-${option.id}`}
            tabIndex={tab === option.id ? 0 : -1}
            className={cn(
              "flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-medium border transition-all",
              tab === option.id
                ? "bg-primary text-primary-foreground border-primary shadow-lg shadow-primary/20"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:bg-accent"
            )}
          >
            <option.icon className="w-4 h-4" aria-hidden="true" />
            {option.label}
          </Link>
        ))}
      </div>

      <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} tabIndex={0}>
      {tab === "all" && (
        <div className="space-y-6 min-w-0">
          <OrgIntegrations showStats={false} initialAddingKind={allConnect} />
          <OrgMcp showStats={false} />
          <OrgTalkoPartners />
        </div>
      )}

      {tab === "telephony" && (
        <div className="space-y-6 min-w-0">
          <OrgIntegrations
            kinds={TELEPHONY_KINDS}
            showStats={false}
            initialAddingKind={telephonyConnect}
          />
          <OrgTalkoPartners />
        </div>
      )}

      {tab === "productivity" && (
        <div className="space-y-6 min-w-0">
          <OrgIntegrations kinds={[...PRODUCTIVITY_KINDS, ...OTHER_KINDS]} showStats={false} />
        </div>
      )}

      {tab === "developers" && (
        <div className="space-y-6 min-w-0">
          <div className="flex items-start gap-3 rounded-3xl border border-border bg-muted/40 p-5 min-w-0">
            <Boxes className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Tool vs Template vs Credential vs Link —</span>{" "}
              Templates are provider blueprints, credentials are vault-sealed secrets (shown once),
              links bind a live credential to an agent. Function/webhook tools live under{" "}
              <Link href="/tools" className="underline underline-offset-2 hover:text-foreground">
                Tools
              </Link>
              .
            </p>
          </div>
          <OrgMcp showStats={false} />
        </div>
      )}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<RouteLoader label="Loading integrations..." />}>
      <IntegrationsContent />
    </Suspense>
  );
}
