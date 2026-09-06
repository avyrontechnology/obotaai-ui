"use client";

import { useState } from "react";

/** Minimal SVG sparkline with hover inspection. Points oldest → newest. */
export function Sparkline({
  values,
  width = 220,
  height = 48,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  label?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values.map(
    (value, index) =>
      `${(index * step).toFixed(1)},${(height - 4 - (value / max) * (height - 10)).toFixed(1)}`
  );

  return (
    <div
      className="relative"
      style={{ width, height }}
      onMouseLeave={() => setHover(null)}
      role="img"
      aria-label={label ?? `Sparkline, ${values.length} points, peak ${max}`}
    >
      <svg width={width} height={height} className="block overflow-visible">
        <polyline
          points={points.join(" ")}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.9}
        />
        {hover !== null && values[hover] !== undefined && (
          <circle
            cx={hover * step}
            cy={height - 4 - (values[hover] / max) * (height - 10)}
            r={3}
            fill="var(--primary)"
          />
        )}
      </svg>
      {/* Hover capture strip */}
      <div className="absolute inset-0 flex" aria-hidden="true">
        {values.map((value, index) => (
          <div
            key={index}
            className="flex-1"
            onMouseEnter={() => setHover(index)}
            data-testid={`spark-bin-${index}`}
          >
            {hover === index && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-popover border border-border px-2 py-0.5 font-mono text-[11px] text-foreground shadow-md">
                {value} call{value === 1 ? "" : "s"}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
