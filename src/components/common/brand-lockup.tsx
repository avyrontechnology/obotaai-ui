"use client";

import { useId } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** The OtobaAI wave, drawn as a transparent vector so the same mark works on
 *  any surface (light, dark, tile or bare). Keep in sync with
 *  public/brand/otoba-mark.svg (favicon). */
export const BRAND_WAVE_PATH =
  "M10 50 C17 43 24 57 31 56 C38 55 39 38 44.5 38.5 C50 39 52 61 57.5 61 C63 61 65 36 71 36 C77 36 80 51 90 50";

export function BrandMark({ className }: { className?: string }) {
  const gradientId = `otoba-wave-${useId().replace(/:/g, "")}`;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FF5F5F" />
          <stop offset="55%" stopColor="#FF8A45" />
          <stop offset="100%" stopColor="#FFAE35" />
        </linearGradient>
      </defs>
      <path
        d={BRAND_WAVE_PATH}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The one OtobaAI lockup, used on every surface (sidebar, auth navbar,
 * login card, invite page): rounded tile holding the wave mark, then
 * "Otoba" in ink + "AI" in ember. The wordmark is rendered text (crisp at
 * any size) — never raster lettering.
 *
 * `tone="auto"` follows the app theme (cream tile + ink in light, warm dark
 * tile + cream in dark). `tone="light"` pins the light palette for surfaces
 * that are always light (auth pages), so a dark OS theme can't wash out the
 * wordmark there.
 */
export function BrandLockup({
  size = "md",
  sublabel,
  href = "/",
  link = true,
  markOnly = false,
  tone = "auto",
  className,
  textClassName,
  sublabelClassName,
}: {
  size?: "sm" | "md";
  sublabel?: string;
  href?: string;
  link?: boolean;
  /** Tile alone (collapsed sidebar). */
  markOnly?: boolean;
  tone?: "auto" | "light";
  className?: string;
  textClassName?: string;
  sublabelClassName?: string;
}) {
  const tile = size === "sm" ? "w-8 h-8 rounded-[10px]" : "w-9 h-9 rounded-[10px]";
  const text = size === "sm" ? "text-lg" : "text-[22px]";
  const auto = tone === "auto";

  const inner = (
    <>
      <span
        className={cn(
          "flex items-center justify-center shrink-0 overflow-hidden border shadow-sm bg-[#FFFBF0] border-[#F3E3C3]",
          auto && "dark:bg-[#24180F] dark:border-white/10",
          tile
        )}
        aria-hidden="true"
      >
        <BrandMark className="w-full h-full p-[3px]" />
      </span>
      {!markOnly && (
        <span className="flex flex-col leading-tight min-w-0">
          <span
            className={cn(
              "font-semibold tracking-tight truncate text-[#111827]",
              auto && "dark:text-[#F5EFE0]",
              text,
              textClassName
            )}
          >
            Otoba<span className="text-[#E73F1E]">AI</span>
          </span>
          {sublabel && (
            <span
              className={cn(
                "text-[11px] font-mono truncate",
                auto ? "text-muted-foreground" : "text-[#6B7280]",
                sublabelClassName
              )}
            >
              {sublabel}
            </span>
          )}
        </span>
      )}
    </>
  );

  if (!link) {
    return (
      <span className={cn("flex items-center gap-2.5", className)} role="img" aria-label="OtobaAI logo">
        {inner}
      </span>
    );
  }
  return (
    <Link href={href} className={cn("flex items-center gap-2.5 shrink-0", className)} aria-label="OtobaAI home">
      {inner}
    </Link>
  );
}
