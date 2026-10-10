"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AppSidebar } from "./app-sidebar";
import { CommandPalette } from "./command-palette";
import { TopBar } from "./top-bar";
import { CommandDock } from "./command-dock";
import { useSuspendedWorkspace } from "@/lib/rbac";
import { useLogout } from "@/services/auth";
import { isPublicAuthPath, markSuspended } from "@/lib/auth-routes";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  // Auth pages render chromeless (no sidebar/topbar/command palette).
  if (isPublicAuthPath(pathname)) {
    return <div className="min-h-screen bg-background text-foreground">{children}</div>;
  }
  return <AuthedShell>{children}</AuthedShell>;
}

/** Spec 0041 Slice B — suspended-tenant banner. Renders only when a
 *  last-known session exists but session-scoped reads 401 (a 401 is a
 *  401 — no probing to distinguish suspended from logged-out). In-place
 *  banner plus logout; it never redirects, so it cannot loop with the
 *  api-client login bounce.
 */
export function SuspendedWorkspaceBanner() {
  const suspended = useSuspendedWorkspace();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const router = useRouter();
  if (!suspended) return null;
  return (
    <div
      role="alert"
      data-testid="suspended-workspace-banner"
      className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2.5 md:px-6"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <p className="font-medium text-amber-900 dark:text-amber-200">
          Workspace suspended — contact your owner to restore access.
        </p>
        <button
          type="button"
          onClick={() =>
            logout.mutate(undefined, {
              onError: () => {
                // A suspended backend may 401 the logout call itself; still
                // sign out client-side with a single replace (never a loop).
                queryClient.clear();
                markSuspended();
                router.replace("/login");
              },
            })
          }
          disabled={logout.isPending}
          className="h-8 px-3 rounded-lg border border-amber-500/40 text-amber-900 dark:text-amber-200 text-xs font-semibold hover:bg-amber-500/20 disabled:opacity-50 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
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
        <SuspendedWorkspaceBanner />
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
