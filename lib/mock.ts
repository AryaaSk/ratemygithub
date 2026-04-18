import type { CategoryKey, Tier } from "@/lib/scoring/rubric";
import { tierForScore, weightedOverall } from "@/lib/scoring/rubric";

export type RepoScore = {
  name: string;
  language: string;
  stars: number;
  lastCommit: string; // ISO date
  score: number;
  summary: string;
  // v3 per-repo scores — optional (v2 rows won't have them).
  impact?: number;
  quality?: number;
  depth?: number;
  impactEvidence?: string[];
  qualityEvidence?: string[];
  depthEvidence?: string[];
  flags?: {
    hasReadme: boolean;
    hasTests: boolean;
    hasCI: boolean;
    hasLicense: boolean;
    hasGitignore: boolean;
    typedLang: boolean;
  };
};

export type RoastTag = {
  label: string;
  body: string;
  flavor: "red" | "blue" | "green" | "yellow" | "purple";
};

export type TimelineEntry = {
  date: string; // ISO
  label: string;
  repo?: string;
};

export type LanguageSlice = { language: string; pct: number };

export type RatedUser = {
  login: string;
  name: string;
  avatar: string;
  bio: string;
  joined: string; // ISO
  location?: string;
  score: number;
  tier: Tier;
  /** 0-100 per category */
  categoryScores: Record<CategoryKey, number>;
  /** 2–5 evidence bullets per category, cited with specifics. */
  categoryReasoning?: Partial<Record<CategoryKey, string[]>>;
  languages: LanguageSlice[];
  /** 52 weeks × 7 days grid, values 0..4 */
  heatmap: number[][];
  repos: RepoScore[];
  roasts: RoastTag[];
  timeline: TimelineEntry[];
  totalRepos: number;
  totalCommits: number;
  followers: number;
  ratedAt: string; // ISO
};

function buildHeatmap(seed: number, density: number): number[][] {
  const weeks: number[][] = [];
  let rng = seed;
  const rand = () => {
    rng = (rng * 9301 + 49297) % 233280;
    return rng / 233280;
  };
  for (let w = 0; w < 52; w++) {
    const week: number[] = [];
    // Density ramps up toward the most recent weeks so heatmaps look lived-in.
    const weekBoost = w / 52;
    for (let d = 0; d < 7; d++) {
      const r = rand();
      const p = density * (0.6 + weekBoost * 0.8);
      if (r > p) week.push(0);
      else if (r > p * 0.65) week.push(1);
      else if (r > p * 0.4) week.push(2);
      else if (r > p * 0.2) week.push(3);
      else week.push(4);
    }
    weeks.push(week);
  }
  return weeks;
}

function user(partial: Omit<RatedUser, "score" | "tier">): RatedUser {
  const score = weightedOverall(partial.categoryScores);
  return { ...partial, score, tier: tierForScore(score).tier };
}

// -----------------------------------------------------------------------------
// Mock users — designed to span tiers, languages, and roast archetypes so the
// UI gets exercised.
// -----------------------------------------------------------------------------

export const MOCK_USERS: RatedUser[] = [
  user({
    login: "torvalds",
    name: "Linus Torvalds",
    avatar: "https://avatars.githubusercontent.com/u/1024025?v=4",
    bio: "Kernel things.",
    joined: "2011-09-03",
    location: "Portland, OR",
    categoryScores: {
      impact: 100,
      consistency: 94,
      quality: 97,
      depth: 99,
      breadth: 72,
      community: 86,
    },
    languages: [
      { language: "C", pct: 82 },
      { language: "Shell", pct: 9 },
      { language: "Assembly", pct: 4 },
      { language: "Makefile", pct: 3 },
      { language: "Other", pct: 2 },
    ],
    heatmap: buildHeatmap(7, 0.82),
    repos: [
      {
        name: "linux",
        language: "C",
        stars: 178_000,
        lastCommit: "2026-04-15",
        score: 100,
        summary: "The Linux kernel. Yes, that one. Still actively maintained.",
      },
      {
        name: "subsurface",
        language: "C++",
        stars: 2_800,
        lastCommit: "2024-05-01",
        score: 76,
        summary: "Dive log software. A surprisingly functional non-kernel side quest.",
      },
      {
        name: "test-tlb",
        language: "C",
        stars: 410,
        lastCommit: "2023-12-14",
        score: 62,
        summary: "TLB microbenchmarks. Niche, but it's Linus so we score it anyway.",
      },
      {
        name: "mtools",
        language: "C",
        stars: 90,
        lastCommit: "2022-03-11",
        score: 48,
        summary: "FAT filesystem tools. Old, battle-tested, barely touched.",
      },
      {
        name: "speakup",
        language: "C",
        stars: 35,
        lastCommit: "2021-08-04",
        score: 42,
        summary: "Screen reader experiments. Notable for existing at all.",
      },
    ],
    roasts: [
      {
        label: "Single-Issue Voter",
        body: "97% of commits are to one repo. You know the one.",
        flavor: "red",
      },
      {
        label: "C-Pilled",
        body: "Has used 14 languages. All are C dialects in a trench coat.",
        flavor: "blue",
      },
      {
        label: "Golden Child",
        body: "linux/linux pulls the entire profile's score up by 11 points on its own.",
        flavor: "green",
      },
    ],
    timeline: [
      { date: "2011-09-04", label: "First commit on GitHub: self-hosting the kernel" },
      { date: "2017-05-21", label: "Accepted the first AArch64 RNG driver" },
      { date: "2023-02-19", label: "Linux 6.2 — 'the usual' release notes legend" },
      { date: "2026-04-15", label: "Most recent commit (today)" },
    ],
    totalRepos: 9,
    totalCommits: 92_100,
    followers: 243_000,
    ratedAt: "2026-04-17T14:02:00Z",
  }),
  user({
    login: "sindresorhus",
    name: "Sindre Sorhus",
    avatar: "https://avatars.githubusercontent.com/u/170270?v=4",
    bio: "Full-time open-sourcerer. Stayed indoors so you didn't have to.",
    joined: "2009-05-11",
    location: "Oslo, Norway",
    categoryScores: {
      impact: 96,
      consistency: 98,
      quality: 93,
      depth: 78,
      breadth: 92,
      community: 96,
    },
    languages: [
      { language: "TypeScript", pct: 51 },
      { language: "JavaScript", pct: 38 },
      { language: "Swift", pct: 6 },
      { language: "HTML", pct: 3 },
      { language: "Other", pct: 2 },
    ],
    heatmap: buildHeatmap(3, 0.88),
    repos: [
      {
        name: "awesome",
        language: "Markdown",
        stars: 340_000,
        lastCommit: "2026-04-12",
        score: 98,
        summary: "A curated list of curated lists. The origin of a whole genre.",
      },
      {
        name: "ky",
        language: "TypeScript",
        stars: 14_000,
        lastCommit: "2026-04-09",
        score: 88,
        summary: "Tiny, elegant fetch wrapper. A surgical strike against axios.",
      },
      {
        name: "chalk",
        language: "JavaScript",
        stars: 21_500,
        lastCommit: "2025-11-02",
        score: 84,
        summary: "ANSI terminal colors. You've imported it by accident twice today.",
      },
      {
        name: "got",
        language: "TypeScript",
        stars: 14_300,
        lastCommit: "2025-09-30",
        score: 82,
        summary: "Human-friendly HTTP client for Node.js.",
      },
      {
        name: "p-map",
        language: "TypeScript",
        stars: 2_900,
        lastCommit: "2025-07-20",
        score: 71,
        summary: "Map over promises concurrently. Precisely what the name says.",
      },
    ],
    roasts: [
      {
        label: "Tiny Module Enjoyer",
        body: "Average repo weighs less than this sentence.",
        flavor: "yellow",
      },
      {
        label: "Framework Abolitionist",
        body: "One function, one file, one repo. Forever.",
        flavor: "blue",
      },
      {
        label: "Golden Child",
        body: "sindresorhus/awesome alone lifts Impact by 15 points.",
        flavor: "green",
      },
    ],
    timeline: [
      { date: "2013-07-05", label: "Shipped the first `awesome` list — started a movement" },
      { date: "2019-03-02", label: "Passed 1,000 published npm packages" },
      { date: "2024-11-14", label: "1.5M weekly downloads across maintained packages" },
      { date: "2026-04-12", label: "Latest commit" },
    ],
    totalRepos: 1_204,
    totalCommits: 138_200,
    followers: 72_000,
    ratedAt: "2026-04-17T13:41:00Z",
  }),
  user({
    login: "tpope",
    name: "Tim Pope",
    avatar: "https://avatars.githubusercontent.com/u/19878?v=4",
    bio: "Vim-adjacent opinions. Occasionally Ruby.",
    joined: "2008-04-09",
    categoryScores: {
      impact: 90,
      consistency: 82,
      quality: 88,
      depth: 72,
      breadth: 55,
      community: 68,
    },
    languages: [
      { language: "Vim Script", pct: 58 },
      { language: "Ruby", pct: 22 },
      { language: "Shell", pct: 12 },
      { language: "Other", pct: 8 },
    ],
    heatmap: buildHeatmap(11, 0.52),
    repos: [
      {
        name: "vim-fugitive",
        language: "Vim Script",
        stars: 20_400,
        lastCommit: "2026-02-08",
        score: 92,
        summary: "Git inside Vim. The plugin your plugins depend on.",
      },
      {
        name: "vim-surround",
        language: "Vim Script",
        stars: 8_200,
        lastCommit: "2024-10-14",
        score: 85,
        summary: "Quoting, parenthesizing, and tag-wrapping — made two keystrokes.",
      },
      {
        name: "vim-commentary",
        language: "Vim Script",
        stars: 4_900,
        lastCommit: "2024-04-02",
        score: 78,
        summary: "gcc, gc, gcip. Commenting done right.",
      },
      {
        name: "vim-rails",
        language: "Vim Script",
        stars: 2_800,
        lastCommit: "2022-12-19",
        score: 61,
        summary: "Rails workflow glue. Still useful if you live in that world.",
      },
      {
        name: "vim-repeat",
        language: "Vim Script",
        stars: 1_700,
        lastCommit: "2023-06-03",
        score: 58,
        summary: "Makes . repeat plugin maps. Tiny, essential.",
      },
    ],
    roasts: [
      {
        label: "Monogamous Ecosystem",
        body: "96% of output is Vim. Still has more stars than most startups.",
        flavor: "blue",
      },
      {
        label: "Quiet Craftsman",
        body: "Commits cluster in 3-day bursts every 11 weeks. Consistent enough.",
        flavor: "yellow",
      },
    ],
    timeline: [
      { date: "2008-06-01", label: "Pushed vim-surround — the first one still in daily use" },
      { date: "2013-04-23", label: "fugitive hits 10k stars" },
      { date: "2026-02-08", label: "Latest commit" },
    ],
    totalRepos: 58,
    totalCommits: 12_400,
    followers: 14_500,
    ratedAt: "2026-04-17T12:55:00Z",
  }),
  user({
    login: "yukikurosawa",
    name: "Yuki Kurosawa",
    avatar: "https://avatars.githubusercontent.com/u/9919?v=4",
    bio: "Graphics, rendering, and the occasional shader demo.",
    joined: "2015-02-19",
    location: "Tokyo",
    categoryScores: {
      impact: 62,
      consistency: 64,
      quality: 78,
      depth: 70,
      breadth: 72,
      community: 48,
    },
    languages: [
      { language: "Rust", pct: 44 },
      { language: "GLSL", pct: 22 },
      { language: "C++", pct: 18 },
      { language: "Python", pct: 10 },
      { language: "Other", pct: 6 },
    ],
    heatmap: buildHeatmap(41, 0.38),
    repos: [
      {
        name: "lumen-rs",
        language: "Rust",
        stars: 1_400,
        lastCommit: "2026-03-22",
        score: 82,
        summary: "Spectral path tracer. Fewer stars than it deserves.",
      },
      {
        name: "skydome-glsl",
        language: "GLSL",
        stars: 310,
        lastCommit: "2025-10-09",
        score: 71,
        summary: "Analytical sky model. Pretty and fast.",
      },
      {
        name: "ppm-viewer",
        language: "Rust",
        stars: 42,
        lastCommit: "2024-06-11",
        score: 54,
        summary: "Minimal PPM image viewer. Exactly what it says.",
      },
      {
        name: "shader-notes",
        language: "Markdown",
        stars: 88,
        lastCommit: "2024-03-01",
        score: 61,
        summary: "Rendering notes that read like a small textbook.",
      },
      {
        name: "tone-mapper",
        language: "C++",
        stars: 22,
        lastCommit: "2023-09-14",
        score: 48,
        summary: "HDR tone-mapping experiments.",
      },
    ],
    roasts: [
      {
        label: "Sneaky Diamond",
        body: "lumen-rs has 1.4k stars but scores higher than repos with 20k.",
        flavor: "green",
      },
      {
        label: "Dark Ages Gap",
        body: "8-month commit gap in 2024. Somebody needed a break.",
        flavor: "yellow",
      },
    ],
    timeline: [
      { date: "2019-11-02", label: "First commit on lumen-rs" },
      { date: "2022-07-18", label: "Shipped spectral rendering rewrite" },
      { date: "2026-03-22", label: "Latest commit" },
    ],
    totalRepos: 27,
    totalCommits: 3_100,
    followers: 1_900,
    ratedAt: "2026-04-17T12:10:00Z",
  }),
  user({
    login: "juniordev22",
    name: "Alex Chen",
    avatar: "https://avatars.githubusercontent.com/u/583231?v=4",
    bio: "Learning in public 🚀 Always shipping!",
    joined: "2022-09-12",
    categoryScores: {
      impact: 12,
      consistency: 58,
      quality: 44,
      depth: 22,
      breadth: 60,
      community: 18,
    },
    languages: [
      { language: "JavaScript", pct: 48 },
      { language: "TypeScript", pct: 22 },
      { language: "Python", pct: 18 },
      { language: "HTML", pct: 8 },
      { language: "CSS", pct: 4 },
    ],
    heatmap: buildHeatmap(99, 0.44),
    repos: [
      {
        name: "todo-app",
        language: "JavaScript",
        stars: 4,
        lastCommit: "2026-04-10",
        score: 32,
        summary: "A todo app. It's localStorage. The README says 'cloud-native'.",
      },
      {
        name: "weather-ai",
        language: "Python",
        stars: 1,
        lastCommit: "2025-11-08",
        score: 28,
        summary: "Calls an LLM with today's weather. Says it's 'AI-powered'.",
      },
      {
        name: "portfolio",
        language: "HTML",
        stars: 0,
        lastCommit: "2025-08-14",
        score: 44,
        summary: "Portfolio site. Lists three of these repos as 'flagship products'.",
      },
      {
        name: "crypto-tracker",
        language: "JavaScript",
        stars: 2,
        lastCommit: "2024-12-30",
        score: 22,
        summary: "Fetches BTC price. Has not been touched since.",
      },
      {
        name: "awesome-mental-models",
        language: "Markdown",
        stars: 11,
        lastCommit: "2024-07-02",
        score: 38,
        summary: "A list. Started strong; stopped at eleven entries.",
      },
    ],
    roasts: [
      {
        label: "README Overpromiser",
        body: "todo-app's README mentions 'distributed systems' 4 times. Total backend: localStorage.",
        flavor: "red",
      },
      {
        label: "Commitment Issues",
        body: "Abandons projects after 18 days, on average. 7 repos, 7 tumbleweeds.",
        flavor: "yellow",
      },
      {
        label: "Framework Tourist",
        body: "Has tried Next, Nuxt, SvelteKit, Remix, and Qwik in one year. Shipped none.",
        flavor: "blue",
      },
    ],
    timeline: [
      { date: "2022-09-13", label: "First public repo: hello-world fork" },
      { date: "2024-02-14", label: "Tweeted 'going full-time OSS'. Stopped committing 3 weeks later." },
      { date: "2026-04-10", label: "Latest commit" },
    ],
    totalRepos: 34,
    totalCommits: 812,
    followers: 41,
    ratedAt: "2026-04-17T11:22:00Z",
  }),
];

export const MOCK_BY_LOGIN: Record<string, RatedUser> = Object.fromEntries(
  MOCK_USERS.map((u) => [u.login.toLowerCase(), u]),
);

/** Additional thin rows (score only, no profile) to pad out leaderboard lists. */
export const MOCK_FILLER: Array<{
  login: string;
  avatar: string;
  score: number;
  tier: Tier;
  ratedAt: string;
}> = [
  mkFiller("mitchellh", 94.2, "2026-04-17T10:05:00Z"),
  mkFiller("dhh", 91.8, "2026-04-17T09:47:00Z"),
  mkFiller("gaearon", 90.6, "2026-04-17T09:41:00Z"),
  mkFiller("rich-harris", 89.9, "2026-04-17T09:12:00Z"),
  mkFiller("antfu", 89.1, "2026-04-17T08:33:00Z"),
  mkFiller("kentcdodds", 85.7, "2026-04-17T08:21:00Z"),
  mkFiller("jlongster", 83.4, "2026-04-17T07:59:00Z"),
  mkFiller("leerob", 81.2, "2026-04-17T07:12:00Z"),
  mkFiller("shuding", 79.8, "2026-04-17T06:54:00Z"),
  mkFiller("aurorascharff", 77.6, "2026-04-17T06:30:00Z"),
  mkFiller("jaredpalmer", 74.9, "2026-04-17T06:11:00Z"),
  mkFiller("kripod", 73.0, "2026-04-17T05:44:00Z"),
  mkFiller("pmndrs", 70.2, "2026-04-17T05:02:00Z"),
  mkFiller("tannerlinsley", 68.3, "2026-04-17T04:31:00Z"),
  mkFiller("developit", 66.1, "2026-04-17T04:11:00Z"),
  mkFiller("kettanaito", 63.5, "2026-04-17T03:38:00Z"),
  mkFiller("steveruizok", 62.7, "2026-04-17T03:20:00Z"),
  mkFiller("iamsauravsharma", 51.4, "2026-04-17T02:58:00Z"),
  mkFiller("code-bro-99", 37.2, "2026-04-17T02:40:00Z"),
  mkFiller("hustler_dev", 29.1, "2026-04-17T02:05:00Z"),
];

function mkFiller(
  login: string,
  score: number,
  ratedAt: string,
): {
  login: string;
  avatar: string;
  score: number;
  tier: Tier;
  ratedAt: string;
} {
  return {
    login,
    avatar: `https://github.com/${login}.png`,
    score,
    tier: tierForScore(score).tier,
    ratedAt,
  };
}

export function leaderboardRows() {
  const rows = [
    ...MOCK_USERS.map((u) => ({
      login: u.login,
      avatar: u.avatar,
      score: u.score,
      tier: u.tier,
      ratedAt: u.ratedAt,
    })),
    ...MOCK_FILLER,
  ];
  return rows.sort((a, b) => b.score - a.score);
}

export function recentRows() {
  const rows = [
    ...MOCK_USERS.map((u) => ({
      login: u.login,
      avatar: u.avatar,
      score: u.score,
      tier: u.tier,
      ratedAt: u.ratedAt,
    })),
    ...MOCK_FILLER,
  ];
  return rows.sort(
    (a, b) => new Date(b.ratedAt).getTime() - new Date(a.ratedAt).getTime(),
  );
}

export function shameRows() {
  return leaderboardRows().slice(-6).reverse();
}
