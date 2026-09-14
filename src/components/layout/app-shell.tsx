"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { TopBar } from "./top-bar";
import { CommandDock } from "./command-dock";

const PUBLIC_PREFIXES = ["/login", "/accept-invite"];

function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return PUBLIC_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Auth pages render chromeless (no sidebar/topbar/command palette).
  if (isPublicPath(pathname)) {
    return (
      <div className="min-h-dvh bg-background text-foreground">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          Skip to content
        </a>
        <main id="main-content" tabIndex={-1} className="min-h-dvh scroll-mt-20 outline-none">
          {children}
        </main>
      </div>
    );
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
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-4 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
      >
        Skip to content
      </a>
      <AppSidebar />
      <div className="relative flex flex-col flex-1 min-w-0 overflow-hidden">
        <TopBar onOpenPalette={openPalette} />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-y-auto p-4 md:p-6 scroll-mt-20 outline-none relative">
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0" aria-hidden="true">
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[120px] rounded-full mix-blend-multiply dark:mix-blend-screen motion-reduce:opacity-50" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] bg-secondary/40 dark:bg-secondary/10 blur-[140px] rounded-full mix-blend-multiply dark:mix-blend-screen motion-reduce:opacity-50" />
          </div>
          <div className="relative z-10 h-full w-full mx-auto max-w-[1600px]">{children}</div>
        </main>
        <div className="md:hidden">
          <CommandDock />
        </div>
      </div>
      <CommandPalette open={paletteOpen} onClose={closePalette} />
    </div>
  );
}
