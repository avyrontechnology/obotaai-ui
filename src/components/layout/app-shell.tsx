"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { TopBar } from "./top-bar";
import { CommandDock } from "./command-dock";

const PUBLIC_PREFIXES = ["/login", "/accept-invite"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Auth pages render chromeless (no sidebar/topbar/command palette).
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }
  return <AuthedShell>{children}</AuthedShell>;
}

function AuthedShell({ children }: { children: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((value) => !value);
      }
      if (event.key === "Escape") setPaletteOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-transparent">
      <AppSidebar />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onOpenPalette={openPalette} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 relative">
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary/40 dark:bg-secondary/10 blur-[140px] rounded-full mix-blend-multiply dark:mix-blend-screen" />
          </div>
          <div className="relative z-10 h-full w-full mx-auto">{children}</div>
        </main>
        <div className="md:hidden">
          <CommandDock />
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
