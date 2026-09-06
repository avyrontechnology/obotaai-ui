import type { Metadata } from "next";
import { Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";

const outfit = Outfit({ 
  subsets: ["latin"],
  variable: "--font-outfit",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  title: "OtobaAI | Premium Voice Agent Playground",
  description: "Experience the next generation of conversational AI with OtobaAI. Create, deploy, and monitor neural voice agents in real-time.",
  keywords: ["Voice AI", "LLM Agents", "Conversational AI", "OtobaAI", "Real-time Voice"],
  icons: {
    icon: "/brand/otobaAI-Flow-—-Favicon-Round.png",
  },
  openGraph: {
    title: "OtobaAI | Premium Voice Agent Playground",
    description: "Experience the next generation of conversational AI with OtobaAI.",
    type: "website",
    images: ["/brand/otoba-logo.png"],
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} ${jetbrains.variable} font-sans min-h-screen bg-background text-foreground antialiased selection:bg-ember-400/30`}>
        <Providers>
          <ErrorBoundary>
            <AppShell>{children}</AppShell>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
