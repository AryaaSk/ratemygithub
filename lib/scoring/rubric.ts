export type CategoryKey =
  | "craft"
  | "consistency"
  | "originality"
  | "impact"
  | "depth"
  | "breadth"
  | "volume"
  | "community";

export type Tier = "S+" | "S" | "A" | "B" | "C" | "D" | "F";

export const RUBRIC_VERSION = 1;

export const CATEGORIES: {
  key: CategoryKey;
  label: string;
  weight: number;
  blurb: string;
}[] = [
  {
    key: "craft",
    label: "Craft",
    weight: 0.2,
    blurb:
      "READMEs, tests, CI, lint configs, typed languages, commit messages.",
  },
  {
    key: "consistency",
    label: "Consistency",
    weight: 0.15,
    blurb: "365-day contribution density, longest streak, recency.",
  },
  {
    key: "originality",
    label: "Originality",
    weight: 0.15,
    blurb: "Non-fork %, distinct READMEs, project-type diversity.",
  },
  {
    key: "impact",
    label: "Impact",
    weight: 0.15,
    blurb: "Log-scaled stars, forks, watchers on owned repos.",
  },
  {
    key: "depth",
    label: "Depth",
    weight: 0.1,
    blurb: "Sustained commits on flagship repos, not one-shot drops.",
  },
  {
    key: "breadth",
    label: "Breadth",
    weight: 0.1,
    blurb: "Language entropy and domain diversity.",
  },
  {
    key: "volume",
    label: "Volume",
    weight: 0.1,
    blurb: "Log-scaled owned-repo count and total commits.",
  },
  {
    key: "community",
    label: "Community",
    weight: 0.05,
    blurb: "External PRs, issues opened, followers.",
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
  { tier: "S+", min: 96, max: 100, name: "Legend", color: "var(--color-tier-splus)", tagline: "untouchable" },
  { tier: "S",  min: 88, max: 95,  name: "Ascended", color: "var(--color-tier-s)",     tagline: "seriously good" },
  { tier: "A",  min: 78, max: 87,  name: "Elite",    color: "var(--color-tier-a)",     tagline: "in the top bracket" },
  { tier: "B",  min: 65, max: 77,  name: "Solid",    color: "var(--color-tier-b)",     tagline: "getting it done" },
  { tier: "C",  min: 50, max: 64,  name: "Competent",color: "var(--color-tier-c)",     tagline: "a real coder" },
  { tier: "D",  min: 35, max: 49,  name: "Amateur",  color: "var(--color-tier-d)",     tagline: "early innings" },
  { tier: "F",  min: 0,  max: 34,  name: "Spectator",color: "var(--color-tier-f)",     tagline: "mostly watching" },
];

export function tierForScore(score: number): (typeof TIERS)[number] {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  return TIERS.find((t) => s >= t.min && s <= t.max) ?? TIERS[TIERS.length - 1];
}

export function weightedOverall(categoryScores: Record<CategoryKey, number>): number {
  const total = CATEGORIES.reduce(
    (sum, c) => sum + (categoryScores[c.key] ?? 0) * c.weight,
    0,
  );
  return Math.round(total * 10) / 10;
}
