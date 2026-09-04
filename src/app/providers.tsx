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
            borderRadius: "16px",
            boxShadow: "0 12px 48px rgba(0,0,0,0.22)",
            padding: "14px 16px",
          },
          classNames: {
            description: "font-mono text-xs opacity-75",
          },
        }}
      />
    </ThemeProvider>
  );
}
