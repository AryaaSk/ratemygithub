"use client";

import Link from "next/link";
import Image from "next/image";
import type { Tier } from "@/lib/scoring/rubric";
import { TierMedal } from "@/components/arcade/tier-medal";
import { cn } from "@/lib/utils";

type Props = {
  rank: number;
  login: string;
  avatar: string;
  score: number;
  tier: Tier;
  percentileLabel?: string;
};

export function LeaderboardRow({
  rank,
  login,
  avatar,
  score,
  tier,
  percentileLabel,
}: Props) {
  const rankColor =
    rank === 1
      ? "text-arcade-red"
      : rank === 2
        ? "text-arcade-blue"
        : rank === 3
          ? "text-arcade-green-deep"
          : "text-arcade-ink/70 dark:text-arcade-cream/70";

  return (
    <Link
      href={`/u/${login}`}
      className={cn(
        "group grid grid-cols-[48px_48px_1fr_auto_auto] items-center gap-4 px-4 py-3",
        "border-b-2 border-arcade-ink/10 dark:border-arcade-cream/10 last:border-b-0",
        "hover:bg-arcade-cream-soft dark:hover:bg-arcade-dark-soft transition-colors",
      )}
    >
      <span
        className={cn("font-pixel text-xl text-right tabular-nums", rankColor)}
      >
        {String(rank).padStart(2, "0")}
      </span>
      <Image
        src={avatar}
        alt=""
        width={40}
        height={40}
        unoptimized
        className="w-10 h-10 pixel-border-sm bg-arcade-cream"
      />
      <div className="min-w-0">
        <div className="font-pixel text-[12px] truncate">{login}</div>
        {percentileLabel && (
          <div className="text-xs opacity-70">{percentileLabel}</div>
        )}
      </div>
      <TierMedal tier={tier} size={28} />
      <div className="flex items-baseline gap-2 justify-end min-w-[88px]">
        <span className="font-score text-3xl text-arcade-red tabular-nums">
          {score.toFixed(1)}
        </span>
        <span className="font-pixel text-[9px] opacity-70">/100</span>
      </div>
    </Link>
  );
}
