"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronsLeft, ChevronsRight, Wallet } from "lucide-react";
import Image from "next/image";
import { Suspense, useState } from "react";
import { NAV_GROUPS, isNavActive } from "./nav-items";
import { useWallet } from "@/services/platform/wallet";
import { cn } from "@/lib/utils";

const COLLAPSE_KEY = "otobaai-sidebar-collapsed";

function isSettingsActive(href: string, pathname: string, tab: string | null): boolean {
  if (!pathname.startsWith("/settings")) return false;
  if (!href.includes("?tab=")) return tab === null || tab === "general";
  return href.endsWith(`tab=${tab ?? "general"}`);
}

export function AppSidebar() {
  return (
    <Suspense>
      <SidebarBody />
    </Suspense>
  );
}

function SidebarBody() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab");
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const { data: wallet } = useWallet();

  const toggle = () => {
    setCollapsed((value) => {
      window.localStorage.setItem(COLLAPSE_KEY, value ? "0" : "1");
      return !value;
    });
  };

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col shrink-0 h-screen sticky top-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        collapsed ? "w-[68px]" : "w-60"
      )}
      aria-label="Primary"
    >
      <div className="flex items-center gap-3.5 h-16 px-4 border-b border-sidebar-border shrink-0">
        <span className="flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden bg-card shrink-0 border border-border p-0.5">
          <Image
            src="/brand/otobaAI-Flow-—-Favicon.png"
            alt="Otobaai icon"
            width={32}
            height={32}
            className="w-full h-full object-contain"
            priority
          />
        </span>
        {!collapsed && (
          <span className="flex items-center min-w-0">
            <span className="text-xl font-bold tracking-tight truncate text-[#2C3340] mb-0.5">OtobaAi</span>
          </span>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto custom-scrollbar py-4 px-2.5 space-y-5" aria-label="Sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-2.5 mb-1.5 text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href.startsWith("/settings")
                  ? isSettingsActive(item.href, pathname, tab)
                  : isNavActive(item, pathname);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        "flex items-center gap-2.5 rounded-xl text-sm transition-colors",
                        collapsed ? "justify-center p-2.5" : "px-2.5 py-2",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                      )}
                    >
                      <item.icon className="w-[18px] h-[18px] shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && active && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {!collapsed && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-2.5">
            <Wallet className="w-4 h-4 text-ember-600 dark:text-ember-400 shrink-0" />
            <div className="min-w-0 leading-tight">
              <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-wider">Credits</p>
              <p className="text-sm font-semibold tabular-nums truncate">
                {(wallet?.balance_credits ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="p-2.5 shrink-0">
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="flex items-center justify-center w-full p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          {collapsed ? <ChevronsRight className="w-4 h-4" /> : <ChevronsLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}
