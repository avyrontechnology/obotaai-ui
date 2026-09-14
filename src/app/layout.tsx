import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";

const outfit = localFont({
  src: [
    {
      path: "../../public/fonts/Outfit-Variable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-outfit",
  display: "swap",
  preload: true,
});

const jetbrains = localFont({
  src: [
    {
      path: "../../public/fonts/JetBrainsMono-Variable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
  preload: true,
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fffbeb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a0a04" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
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
