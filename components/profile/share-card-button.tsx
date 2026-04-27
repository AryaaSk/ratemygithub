"use client";

import { PixelButton } from "@/components/arcade/pixel-button";
import type { Tier } from "@/lib/scoring/rubric";

type Props = {
  login: string;
  score: number;
  tier?: Tier;
  rank?: number;
  roast?: string;
};

export function ShareCardButton({ login, score, tier, rank, roast }: Props) {
  const onShare = () => {
    const tierBit = tier ? ` (${tier} tier)` : "";
    const rankBit = rank ? `, ranked #${rank}` : "";
    const lines = [
      `${login} just got rated ${score.toFixed(1)}/100${tierBit} on his public github profile${rankBit}.`,
    ];
    if (roast) {
      lines.push("");
      lines.push(`favourite roast: "${roast}"`);
    }
    lines.push("");
    lines.push("think you can do better?");
    const text = lines.join("\n");
    const url = "https://ratemygithub.app";
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  };

  return (
    <PixelButton variant="secondary" onClick={onShare}>
      Share on X
    </PixelButton>
  );
}
