"use client";

import { PixelButton } from "@/components/arcade/pixel-button";
import type { Tier } from "@/lib/scoring/rubric";
import { TIERS } from "@/lib/scoring/rubric";

type Props = {
  login: string;
  score: number;
  tier?: Tier;
};

export function ShareCardButton({ login, score, tier }: Props) {
  const onShare = () => {
    const tierName =
      tier && TIERS.find((t) => t.tier === tier)?.name.toLowerCase();
    const tierLabel = tier ? `${tier} tier — ${tierName}` : "";
    const text = [
      `${login} · ${score.toFixed(1)}/100${tier ? ` · ${tierLabel}` : ""}`,
      "",
      "think you can beat it? ↓",
      "",
      "(built using @zoral)",
    ].join("\n");
    const url =
      typeof window !== "undefined"
        ? `${window.location.origin}/u/${login}`
        : `https://ratemygithub.app/u/${login}`;
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
