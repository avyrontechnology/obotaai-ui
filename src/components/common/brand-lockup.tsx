"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The one OtobaAI lockup, used on every surface (sidebar, auth navbar,
 * login card, invite page). Mirrors the brand reference: cream
 * rounded tile holding the FULL wave mark, then "Otoba" in ink + "AI" in
 * ember. The wordmark is rendered text (crisp at any size, theme-aware) —
 * never the raster lettering.
 *
 * The tile uses object-contain, never cover: the mark asset is wide and
 * cover would decapitate the wave sides inside a square tile.
 */
export function BrandLockup({
  size = "md",
  sublabel,
  href = "/",
  link = true,
  markOnly = false,
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
  className?: string;
  textClassName?: string;
  sublabelClassName?: string;
}) {
  const tile = size === "sm" ? "w-8 h-8 rounded-[10px]" : "w-9 h-9 rounded-[10px]";
  const text = size === "sm" ? "text-lg" : "text-[22px]";
  const markSize = size === "sm" ? 32 : 36;

  const inner = (
    <>
      <span
        className={cn(
          "flex items-center justify-center shrink-0 overflow-hidden bg-[#FFFBF0] border border-[#F3E3C3] shadow-sm",
          tile
        )}
        aria-hidden="true"
      >
        <Image
          src="/brand/otobaAI-Flow-—-Favicon.png"
          alt=""
          width={markSize}
          height={markSize}
          className="w-full h-full object-contain p-[3px]"
          priority
        />
      </span>
      {!markOnly && (
        <span className="flex flex-col leading-tight min-w-0">
          <span className={cn("font-semibold tracking-tight truncate text-[#111827] dark:text-[#F5EFE0]", text, textClassName)}>
            Otoba<span className="text-[#E73F1E]">AI</span>
          </span>
          {sublabel && (
            <span className={cn("text-[11px] text-muted-foreground font-mono truncate", sublabelClassName)}>{sublabel}</span>
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
