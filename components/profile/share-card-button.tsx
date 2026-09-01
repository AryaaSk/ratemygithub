"use client";

import { PixelButton } from "@/components/arcade/pixel-button";
import type { Tier } from "@/lib/scoring/rubric";

type Props = {
  ratingId?: string;
  login: string;
  score: number;
  tier?: Tier;
  rank?: number;
  roast?: string;
};

export function ShareCardButton({
  ratingId,
  login,
  score,
  tier,
  rank,
  roast,
}: Props) {
  const buildIntent = (shareUrl: string) => {
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
    return `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      text,
    )}&url=${encodeURIComponent(shareUrl)}`;
  };

  const onShare = async () => {
    const fallbackUrl = new URL("/", window.location.origin).toString();
    if (!ratingId) {
      window.open(buildIntent(fallbackUrl), "_blank", "noopener,noreferrer");
      return;
    }

    // Open synchronously so browsers do not block the popup while the
    // referral registry request is in flight.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;

    let intent = buildIntent(fallbackUrl);
    try {
      const response = await fetch("/api/referrals/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ratingId }),
      });
      if (!response.ok) throw new Error(`Share registration returned ${response.status}`);
      const body = (await response.json()) as { referralId?: string };
      if (!body.referralId) throw new Error("Share registration omitted referralId");
      const taggedUrl = new URL("/", window.location.origin);
      taggedUrl.searchParams.set("ref", body.referralId);
      intent = buildIntent(taggedUrl.toString());
    } catch (error) {
      console.warn("[rmg] sharing without referral attribution", error);
    }

    if (popup) {
      popup.location.replace(intent);
    } else {
      window.open(intent, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <PixelButton variant="secondary" onClick={onShare}>
      Share on X
    </PixelButton>
  );
}
