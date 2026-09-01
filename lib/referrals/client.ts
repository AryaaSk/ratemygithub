"use client";

import { normalizeLandingPath, normalizeReferralId } from "./shared";

const captures = new Map<string, Promise<void>>();

export function captureReferral(
  rawReferral?: string | null,
  rawPath?: string | null,
): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const referralId = normalizeReferralId(
    rawReferral ?? new URLSearchParams(window.location.search).get("ref"),
  );
  if (!referralId) return Promise.resolve();
  const landingPath = normalizeLandingPath(rawPath ?? window.location.pathname);
  const key = `${landingPath}?ref=${referralId}`;
  const existing = captures.get(key);
  if (existing) return existing;

  const capture = fetch("/api/referrals/visit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ref: referralId, path: landingPath }),
    credentials: "same-origin",
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Referral capture returned ${response.status}`);
    })
    .catch((error) => {
      captures.delete(key);
      console.warn("[rmg] referral capture skipped", error);
    });
  captures.set(key, capture);
  return capture;
}

export function captureReferralFromLocation(): Promise<void> {
  return captureReferral();
}
