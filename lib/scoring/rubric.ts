export type CategoryKey =
  | "consistency"
  | "impact"
  | "quality"
  | "breadth"
  | "depth"
  | "community";

export type Tier = "S" | "A" | "B" | "C" | "D" | "F";

export const RUBRIC_VERSION = 2;

export const CATEGORIES: {
  key: CategoryKey;
  label: string;
  weight: number;
  blurb: string;
}[] = [
  {
    key: "impact",
    label: "Impact",
    weight: 0.25,
    blurb:
      "Log-scaled stars, forks, contributors, and external adoption of owned repos.",
  },
  {
    key: "consistency",
    label: "Consistency",
    weight: 0.2,
    blurb:
      "Commit frequency, longest streak, recency — do you actually show up?",
  },
  {
    key: "quality",
    label: "Quality",
    weight: 0.2,
    blurb:
      "README, tests, CI, license, .gitignore — the boring things that say you care.",
  },
  {
    key: "depth",
    label: "Depth",
    weight: 0.15,
    blurb:
      "Largest project, longest-maintained repo. Sustained work, not one-shots.",
  },
  {
    key: "breadth",
    label: "Breadth",
    weight: 0.1,
    blurb: "Language entropy and project-type diversity across owned repos.",
  },
  {
    key: "community",
    label: "Community",
    weight: 0.1,
    blurb: "External PRs, issues opened, engagement on other people's code.",
  },
];

export const TIERS: {
  tier: Tier;
  min: number;
  max: number;
  name: string;
  color: string;
  tagline: string;
}[] = [
  { tier: "S", min: 90, max: 100, name: "Mass-producing humans", color: "var(--color-tier-splus)", tagline: "gold crown" },
  { tier: "A", min: 80, max: 89,  name: "Ship machine",          color: "var(--color-tier-s)",     tagline: "silver medal" },
  { tier: "B", min: 70, max: 79,  name: "Solid engineer",        color: "var(--color-tier-a)",     tagline: "bronze medal" },
  { tier: "C", min: 60, max: 69,  name: "Getting there",         color: "var(--color-tier-b)",     tagline: "green room" },
  { tier: "D", min: 40, max: 59,  name: "README enthusiast",     color: "var(--color-arcade-yellow)", tagline: "yellow light" },
  { tier: "F", min: 0,  max: 39,  name: "GitHub tourist",        color: "var(--color-tier-s)",     tagline: "red alert" },
];

export function tierForScore(score: number): (typeof TIERS)[number] {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return TIERS.find((t) => s >= t.min && s <= t.max) ?? TIERS[TIERS.length - 1];
}

export function weightedOverall(
  categoryScores: Record<CategoryKey, number>,
): number {
  const raw = CATEGORIES.reduce(
    (sum, c) => sum + (categoryScores[c.key] ?? 0) * c.weight,
    0,
  );
  return roundScore(applyCurve(raw));
}

/**
 * Gentle upward curve so the rubric isn't miserly at the top. The shape:
 *   • 0–40 unchanged (a bad profile should still feel bad)
 *   • 40–85 lifted by up to ~6 points (solid engineers should reach B/A)
 *   • 85–100 lifted by up to ~4 points, with the top capped at 100
 *
 * Expressed as `raw + bump(raw)` where bump is a smooth bell centered at 70
 * plus a small asymptotic lift near the ceiling.
 */
export function applyCurve(raw: number): number {
  const x = Math.max(0, Math.min(100, raw));
  // Bell-ish curve peaking around raw=70 with amplitude ~6.
  const bell = 6 * Math.exp(-Math.pow((x - 70) / 22, 2));
  // Ceiling lift: pulls 85+ scores a bit closer to 100 (but never past it).
  const ceilLift = x > 82 ? ((x - 82) / 18) * 4 : 0;
  const curved = x + bell + ceilLift;
  return Math.min(100, curved);
}

function roundScore(s: number): number {
  return Math.round(s * 10) / 10;
}
