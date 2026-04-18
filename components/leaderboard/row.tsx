"use client";

import Link from "next/link";
import Image from "next/image";
import type { Tier } from "@/lib/scoring/rubric";
import { TIERS } from "@/lib/scoring/rubric";
import { TierMedal } from "@/components/arcade/tier-medal";
import { cn } from "@/lib/utils";

type Props = {
  rank: number;
  login: string;
  avatar: string;
  score: number;
  tier: Tier;
};

export function LeaderboardRow({
  rank,
  login,
  avatar,
  score,
  tier,
}: Props) {
  const tierName =
    TIERS.find((t) => t.tier === tier)?.name.toLowerCase() ?? "";
  const rankColor =
    rank === 1
      ? "text-arcade-red"
      : rank === 2
        ? "text-arcade-blue"
        : rank === 3
          ? "text-arcade-green-deep"
          : "text-arcade-ink/60 dark:text-arcade-cream/60";

  return (
    <Link
      href={`/u/${login}`}
      className={cn(
        "group flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3",
        "border-b border-arcade-ink/10 dark:border-arcade-cream/10 last:border-b-0",
        "hover:bg-arcade-cream-soft dark:hover:bg-arcade-dark-soft transition-colors",
      )}
    >
      <span
        className={cn(
          "font-pixel text-base sm:text-lg text-right tabular-nums w-8 sm:w-10 shrink-0",
          rankColor,
        )}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <Image
        src={avatar}
        alt=""
        width={36}
        height={36}
        unoptimized
        className="w-9 h-9 pixel-border-sm bg-arcade-cream shrink-0"
      />
      <div className="min-w-0 flex-1">
        <div className="font-pixel text-[11px] sm:text-xs truncate">
          {login}
        </div>
        {tierName && (
          <div className="font-pixel text-[9px] sm:text-[10px] uppercase tracking-widest opacity-60 truncate">
            {tierName}
          </div>
        )}
      </div>
      <TierMedal tier={tier} size={24} className="shrink-0 hidden sm:inline-flex" />
      <div className="flex items-baseline gap-1 justify-end shrink-0">
        <span className="font-score text-2xl sm:text-3xl text-arcade-ink dark:text-arcade-cream tabular-nums">
          {score.toFixed(1)}
        </span>
        <span className="font-pixel text-[9px] opacity-50 hidden sm:inline">
          /100
        </span>
      </div>
    </Link>
  );
}
