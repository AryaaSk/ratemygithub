"use client";

import * as React from "react";
import type { Tier } from "@/lib/scoring/rubric";
import { TIERS } from "@/lib/scoring/rubric";
import { cn } from "@/lib/utils";

type Props = {
  tier: Tier;
  size?: number;
  className?: string;
  animate?: boolean;
};

/**
 * Pixel-art medal. 16x16 grid, hand-drawn per tier by offsetting a hex + star.
 * Kept as inline SVG so the tier color, border, and glyph are all controllable.
 */
export function TierMedal({ tier, size = 64, className, animate = false }: Props) {
  const def = TIERS.find((t) => t.tier === tier) ?? TIERS[TIERS.length - 1];
  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        animate && "crt-flicker",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 16 16"
        width={size}
        height={size}
        style={{ imageRendering: "pixelated" }}
        aria-label={`Tier ${def.tier} — ${def.name}`}
      >
        <g shapeRendering="crispEdges">
          {/* hex body */}
          <rect x="5" y="1" width="6" height="1" fill={def.color} />
          <rect x="3" y="2" width="10" height="1" fill={def.color} />
          <rect x="2" y="3" width="12" height="1" fill={def.color} />
          <rect x="1" y="4" width="14" height="8" fill={def.color} />
          <rect x="2" y="12" width="12" height="1" fill={def.color} />
          <rect x="3" y="13" width="10" height="1" fill={def.color} />
          <rect x="5" y="14" width="6" height="1" fill={def.color} />

          {/* outline */}
          <rect x="5" y="0" width="6" height="1" fill="#1a1a1e" />
          <rect x="3" y="1" width="2" height="1" fill="#1a1a1e" />
          <rect x="11" y="1" width="2" height="1" fill="#1a1a1e" />
          <rect x="2" y="2" width="1" height="1" fill="#1a1a1e" />
          <rect x="13" y="2" width="1" height="1" fill="#1a1a1e" />
          <rect x="1" y="3" width="1" height="1" fill="#1a1a1e" />
          <rect x="14" y="3" width="1" height="1" fill="#1a1a1e" />
          <rect x="0" y="4" width="1" height="8" fill="#1a1a1e" />
          <rect x="15" y="4" width="1" height="8" fill="#1a1a1e" />
          <rect x="1" y="12" width="1" height="1" fill="#1a1a1e" />
          <rect x="14" y="12" width="1" height="1" fill="#1a1a1e" />
          <rect x="2" y="13" width="1" height="1" fill="#1a1a1e" />
          <rect x="13" y="13" width="1" height="1" fill="#1a1a1e" />
          <rect x="3" y="14" width="2" height="1" fill="#1a1a1e" />
          <rect x="11" y="14" width="2" height="1" fill="#1a1a1e" />
          <rect x="5" y="15" width="6" height="1" fill="#1a1a1e" />

          {/* highlight */}
          <rect x="5" y="2" width="1" height="1" fill="#ffffff" opacity="0.6" />
          <rect x="3" y="3" width="2" height="1" fill="#ffffff" opacity="0.3" />

          {/* letter (rendered in center) */}
          <text
            x="8"
            y="11"
            textAnchor="middle"
            fontFamily="'Press Start 2P', monospace"
            fontSize="5"
            fill="#1a1a1e"
          >
            {def.tier}
          </text>
        </g>
      </svg>
    </div>
  );
}
