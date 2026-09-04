"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronRight, CircleUserRound, Command, LogOut, Search, User, Wallet } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useWallet } from "@/services/platform/wallet";
import { cn } from "@/lib/utils";

const SEGMENT_LABELS: Record<string, string> = {
  agents: "Agents",
  calls: "Call History",
  batches: "Campaigns",
  playground: "Studio",
  library: "Library",
  graphs: "Graphs",
  workflows: "Workflows",
  settings: "Settings",
  setup: "Setup",
  loading: "Loading",
};

function breadcrumbs(pathname: string): { label: string; href: string }[] {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return [{ label: "Dashboard", href: "/" }];
  const crumbs: { label: string; href: string }[] = [{ label: "Dashboard", href: "/" }];
  let href = "";
  for (const segment of segments) {
    href += `/${segment}`;
    const label = SEGMENT_LABELS[segment] ?? (segment.length > 12 ? `${segment.slice(0, 12)}…` : segment);
    crumbs.push({ label, href });
  }
  return crumbs;
}

export function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: wallet } = useWallet();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const crumbs = breadcrumbs(pathname);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointer = (event: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  return (
    <header className="h-16 shrink-0 border-b border-border bg-background/80 backdrop-blur-md flex items-center gap-3 px-4 md:px-6 relative z-30">
      <nav aria-label="Breadcrumb" className="min-w-0">
        <ol className="flex items-center gap-1.5 text-sm min-w-0">
          {crumbs.map((crumb, index) => {
            const last = index === crumbs.length - 1;
            return (
              <li key={crumb.href} className="flex items-center gap-1.5 min-w-0">
                {index > 0 && <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden="true" />}
                {last ? (
                  <span aria-current="page" className="font-medium text-foreground truncate">
                    {crumb.label}
                  </span>
                ) : (
                  <Link href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                    {crumb.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <button
          onClick={onOpenPalette}
          className="hidden sm:flex items-center gap-2 h-9 pl-3 pr-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground text-sm transition-colors min-w-44 justify-between"
          aria-label="Open command palette"
        >
          <span className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>Search…</span>
          </span>
          <kbd className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-muted font-mono text-[10px]">
            <Command className="w-3 h-3" />K
          </kbd>
        </button>

        <button
          onClick={() => router.push("/settings?tab=billing")}
          title="Credits — open billing"
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-border bg-card text-sm hover:bg-accent transition-colors"
        >
          <Wallet className="w-4 h-4 text-cyan-700 dark:text-cyan-400" />
          <span className="font-semibold tabular-nums">{(wallet?.balance_credits ?? 0).toLocaleString()}</span>
        </button>

        <button
          onClick={() => router.push("/settings?tab=notifications")}
          title="Notifications"
          aria-label="Notifications"
          className="hidden sm:flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <Bell className="w-[18px] h-[18px]" />
        </button>

        <ThemeToggle />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Account menu"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <CircleUserRound className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div
              role="menu"
              aria-label="Account"
              className="absolute right-0 top-11 w-52 rounded-2xl border border-border bg-popover text-popover-foreground shadow-xl p-1.5 z-50"
            >
              {[
                { label: "Profile settings", href: "/settings?tab=general", icon: User },
                { label: "Billing", href: "/settings?tab=billing", icon: Wallet },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm hover:bg-muted transition-colors"
                >
                  <item.icon className="w-4 h-4 text-muted-foreground" />
                  {item.label}
                </Link>
              ))}
              <div className="my-1.5 h-px bg-border" />
              <button
                role="menuitem"
                disabled
                title="Available after the auth milestone"
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm",
                  "text-muted-foreground opacity-60 cursor-not-allowed"
                )}
              >
                <LogOut className="w-4 h-4" />
                Sign out
                <span className="ml-auto text-[10px] font-mono uppercase">soon</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
