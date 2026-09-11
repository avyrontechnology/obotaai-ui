"use client";

import { Toaster } from "sonner";
import { QueryProvider } from "@/providers/query-provider";
import { ThemeProvider } from "next-themes";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>{children}</QueryProvider>
      <Toaster
        position="bottom-right"
        offset="24px"
        mobileOffset="88px"
        gap={10}
        closeButton
        toastOptions={{
          style: {
            background: "var(--card)",
            color: "var(--card-foreground)",
            border: "1px solid var(--border)",
            borderRadius: "1rem",
            boxShadow:
              "0 12px 32px -12px color-mix(in srgb, var(--foreground) 18%, transparent), 0 2px 8px -2px color-mix(in srgb, var(--foreground) 10%, transparent)",
            padding: "14px 16px",
            fontFamily: "var(--font-outfit), ui-sans-serif, system-ui, sans-serif",
          },
          classNames: {
            title: "text-sm font-semibold tracking-tight",
            description: "font-mono text-xs leading-relaxed text-muted-foreground",
            icon: "shrink-0",
            closeButton:
              "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          },
        }}
      />
    </ThemeProvider>
  );
}
