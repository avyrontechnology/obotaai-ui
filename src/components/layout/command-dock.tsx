"use client";

import { MessagesSquare, Activity, Layers, Database, PhoneCall, Settings, Workflow, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";

export function CommandDock() {
  const pathname = usePathname();

  const dockItems = [
    { icon: LayoutDashboard, label: "Dashboard", href: "/" },
    { icon: Activity, label: "OboFleet", href: "/agents" },
    { icon: PhoneCall, label: "Call History", href: "/calls" },
    { icon: Layers, label: "Campaigns", href: "/batches" },
    { icon: MessagesSquare, label: "Playground", href: "/playground" },
    { icon: Database, label: "Knowledge Base", href: "/library" },
    { icon: Workflow, label: "Flows", href: "/flows" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[calc(100vw-1.5rem)]">
      <nav
        aria-label="Main Navigation"
        className="bg-card/80 dark:bg-black/40 backdrop-blur-md border border-border dark:border-white/10 shadow-[0_4px_30px_rgba(0,0,0,0.1)] rounded-xl p-1.5 sm:p-2 flex items-center gap-2 sm:gap-6 overflow-x-auto sm:overflow-visible custom-scrollbar"
      >
        <div className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2">
          {dockItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                aria-label={item.label}
                title={item.label}
                className={`p-2.5 sm:p-3 rounded-xl transition-all duration-300 relative group flex items-center justify-center shrink-0
                  ${isActive ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}
              >
                <item.icon className="w-5 h-5 transition-transform group-hover:scale-110" />

                {/* Tooltip */}
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 px-2 py-1 bg-popover text-popover-foreground text-xs rounded-md opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity pointer-events-none whitespace-nowrap shadow-xl border border-border hidden sm:block">
                  {item.label}
                </div>
              </Link>
            );
          })}
        </div>

        <div className="w-[1px] h-8 bg-border opacity-50 shrink-0" />

        <div className="px-1 sm:px-2 shrink-0">
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}

