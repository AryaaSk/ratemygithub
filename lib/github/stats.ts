import "server-only";
import type {
  GHContributions,
  GHEvent,
  GHRepo,
  GHTreeItem,
  GHUser,
} from "./fetcher";

/**
 * Server-computed statistics. Deterministic, cheap, no LLM.
 *
 * Prefers GraphQL contributions data (full 365 days, accurate). Falls back
 * to the events feed (~90 days) only if GraphQL fails — in which case we
 * also flag the heatmap so the UI can label it honestly.
 */

export type ProfileStats = {
  heatmap: number[][]; // 52×7
  heatmapWindowDays: number; // 365 when from GraphQL, ~90 from events fallback
  totalCommitsYear: number | null; // null when we fell back to events
  totalPRsYear: number | null;
  totalIssuesYear: number | null;
  nightOwlPct: number;
  /**
   * Fraction (0–1) of non-fork repos last pushed > 2 years ago. A real
   * "graveyard" signal that doesn't false-positive on repos we simply
   * didn't fetch commits for. Replaces the old graveyardCount.
   */
  staleRepoRatio: number;
  /**
   * Sum of recent-commit samples (last 30 each) across the repos we did
   * deep-analyze. Proxy for "horizontal depth" — a high-output builder
   * shipping many small projects has a high multiRepoVolume even if no
   * single repo has 100+ commits.
   */
  multiRepoVolume: number;
  /**
   * Heuristic: public commit count is suspiciously low relative to the
   * number of recently-pushed repos, suggesting the user hasn't opted in
   * to "show private contributions". When true, the grader is instructed
   * to treat Consistency as if totalCommitsYear were higher.
   */
  privateWorkLikely: boolean;
  soloPct: number;
  mostRecentPush: string | null;
  totalStars: number;
  totalForks: number;
  langPcts: Array<{ language: string; pct: number }>;
  domainGuess: string;
  githubJoinedAt: string;
};

// ---------------- Heatmap ------------------------------------------------
function bucketCommits(n: number): number {
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n <= 3) return 2;
  if (n <= 9) return 3;
  return 4;
}

/** Guarantee a 52×7 grid: pad short rows/columns with 0. */
function normalizeHeatmap(grid: number[][]): number[][] {
  const out: number[][] = [];
  for (const w of grid.slice(-52)) {
    const days = [...w];
    while (days.length < 7) days.push(0);
    out.push(days.slice(0, 7).map((d) => Math.max(0, Math.min(4, Math.floor(d)))));
  }
  while (out.length < 52) out.unshift([0, 0, 0, 0, 0, 0, 0]);
  return out;
}

export function heatmapFromContributions(c: GHContributions): number[][] {
  // GraphQL returns 53 weeks. The most recent one is typically partial — fewer
  // than 7 days — because it's the current week. normalizeHeatmap pads it out.
  const weeks = c.calendar.weeks.map((w) =>
    w.contributionDays.map((d) => bucketCommits(d.contributionCount)),
  );
  return normalizeHeatmap(weeks);
}

export function heatmapFromEvents(events: GHEvent[]): number[][] {
  const weeks: number[][] = Array.from({ length: 52 }, () => Array(7).fill(0));
  const now = new Date();
  const msPerDay = 86_400_000;
  for (const e of events) {
    if (e.type !== "PushEvent") continue;
    const d = new Date(e.created_at);
    const daysAgo = Math.floor((now.getTime() - d.getTime()) / msPerDay);
    if (daysAgo < 0 || daysAgo >= 52 * 7) continue;
    const weekIdx = 51 - Math.floor(daysAgo / 7);
    const dayIdx = d.getUTCDay();
    const commits = e.payload?.commits?.length ?? 1;
    weeks[weekIdx][dayIdx] = bucketCommits(
      bucketReverse(weeks[weekIdx][dayIdx]) + commits,
    );
  }
  return normalizeHeatmap(weeks);
}
function bucketReverse(b: number): number {
  return [0, 1, 2, 5, 10][b] ?? 0;
}

// ---------------- Night-owl / solo ---------------------------------------
export function computeNightOwlPct(events: GHEvent[]): number {
  const pushes = events.filter((e) => e.type === "PushEvent");
  if (pushes.length === 0) return 0;
  const owl = pushes.filter((e) => {
    const h = new Date(e.created_at).getUTCHours();
    return h < 6;
  }).length;
  return Math.round((owl / pushes.length) * 100);
}

export function computeSoloPct(events: GHEvent[], login: string): number {
  if (events.length === 0) return 0;
  const own = events.filter((e) =>
    e.repo?.name?.toLowerCase().startsWith(`${login.toLowerCase()}/`),
  ).length;
  return Math.round((own / events.length) * 100);
}

// ---------------- Languages ----------------------------------------------
export function languagePctsFromBytes(
  bytes: GHContributions["languageBytes"],
): ProfileStats["langPcts"] {
  if (bytes.length === 0) return [{ language: "Unknown", pct: 100 }];
  const total = bytes.reduce((a, b) => a + b.bytes, 0);
  if (total === 0) return [{ language: "Unknown", pct: 100 }];
  const top = bytes.slice(0, 6).map((b) => ({
    language: b.language,
    pct: Math.round((b.bytes / total) * 100),
  }));
  const sum = top.reduce((a, b) => a + b.pct, 0);
  if (sum < 100) top.push({ language: "Other", pct: 100 - sum });
  return top;
}

export function languagePctsFromRepos(repos: GHRepo[]): ProfileStats["langPcts"] {
  // Fallback when GraphQL isn't available. Counts repos-per-language.
  const counts = new Map<string, number>();
  for (const r of repos) {
    if (r.fork) continue;
    if (!r.language) continue;
    counts.set(r.language, (counts.get(r.language) ?? 0) + 1);
  }
  const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [{ language: "Unknown", pct: 100 }];
  const entries = Array.from(counts.entries())
    .map(([language, n]) => ({ language, pct: Math.round((n / total) * 100) }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 6);
  const sum = entries.reduce((a, b) => a + b.pct, 0);
  if (sum < 100) entries.push({ language: "Other", pct: 100 - sum });
  return entries;
}

// ---------------- Misc ---------------------------------------------------
export function guessDomain(repos: GHRepo[]): string {
  const langs = new Set(
    repos.map((r) => r.language?.toLowerCase()).filter(Boolean),
  );
  if (langs.has("rust") || langs.has("c") || langs.has("c++")) return "systems";
  if (langs.has("python") && (langs.has("jupyter notebook") || langs.has("cuda"))) return "ml";
  if (langs.has("typescript") || langs.has("javascript")) return "web";
  if (langs.has("swift") || langs.has("kotlin") || langs.has("dart")) return "mobile";
  if (langs.has("go")) return "infra";
  return "general";
}

/**
 * Honest "abandoned" signal: non-fork repos whose latest push is more than
 * `staleDays` ago, as a fraction of total non-fork repos. Unlike the old
 * graveyardCount, this uses pushed_at (which we always have) instead of
 * commit counts (which we only have for the top ~12 repos).
 */
export function staleRepoRatio(repos: GHRepo[], staleDays = 730): number {
  const cutoff = Date.now() - staleDays * 86_400_000;
  const owned = repos.filter((r) => !r.fork);
  if (owned.length === 0) return 0;
  const stale = owned.filter((r) => new Date(r.pushed_at).getTime() < cutoff);
  return Math.round((stale.length / owned.length) * 100) / 100;
}

/**
 * Horizontal depth proxy — total commits we sampled across all deeply
 * analyzed repos. A high number means the author is actively pushing
 * across many projects even if no single project is individually deep.
 */
export function multiRepoVolume(
  commitsByRepo: Map<string, number>,
): number {
  let n = 0;
  for (const c of commitsByRepo.values()) n += c;
  return n;
}

/**
 * True when public contribution count is suspiciously low vs. the number
 * of recently-pushed repos. Strongly suggests the account hasn't toggled
 * on "Include private contributions on my profile" — a real undercount
 * that Consistency scoring should correct for.
 */
export function computePrivateWorkLikely(args: {
  totalCommitsYear: number | null;
  repos: GHRepo[];
  recentDays?: number;
}): boolean {
  const total = args.totalCommitsYear ?? 0;
  const cutoff = Date.now() - (args.recentDays ?? 90) * 86_400_000;
  const recentPushes = args.repos.filter(
    (r) => !r.fork && new Date(r.pushed_at).getTime() >= cutoff,
  ).length;
  return total <= 150 && recentPushes >= 3;
}

export function buildStats(args: {
  user: GHUser;
  repos: GHRepo[];
  events: GHEvent[];
  commitsByRepo: Map<string, number>;
  contributions: GHContributions | null;
}): ProfileStats {
  const owned = args.repos.filter((r) => !r.fork);
  const heatmap = args.contributions
    ? heatmapFromContributions(args.contributions)
    : heatmapFromEvents(args.events);
  const heatmapWindowDays = args.contributions ? 365 : 90;
  const nightOwlPct = computeNightOwlPct(args.events);
  const soloPct = computeSoloPct(args.events, args.user.login);
  const langPcts = args.contributions
    ? languagePctsFromBytes(args.contributions.languageBytes)
    : languagePctsFromRepos(args.repos);
  const totalStars = owned.reduce((a, r) => a + r.stargazers_count, 0);
  const totalForks = owned.reduce((a, r) => a + r.forks_count, 0);
  const mostRecentPush = owned.reduce<string | null>(
    (acc, r) => (!acc || r.pushed_at > acc ? r.pushed_at : acc),
    null,
  );
  const totalCommitsYear =
    args.contributions?.totalCommitContributions ?? null;
  return {
    heatmap,
    heatmapWindowDays,
    totalCommitsYear,
    totalPRsYear: args.contributions?.totalPullRequestContributions ?? null,
    totalIssuesYear: args.contributions?.totalIssueContributions ?? null,
    nightOwlPct,
    staleRepoRatio: staleRepoRatio(args.repos),
    multiRepoVolume: multiRepoVolume(args.commitsByRepo),
    privateWorkLikely: computePrivateWorkLikely({
      totalCommitsYear,
      repos: args.repos,
    }),
    soloPct,
    mostRecentPush,
    totalStars,
    totalForks,
    langPcts,
    domainGuess: guessDomain(args.repos),
    githubJoinedAt: args.contributions?.createdAt ?? args.user.created_at,
  };
}

/**
 * Pick the set of non-fork repos to deeply analyse in Pass 1 + Pass 2.
 *
 * Primary: every non-fork repo pushed in the last `recentDays` (capped at
 * `max`). No star threshold — a 0-star repo you pushed yesterday counts as
 * real work.
 *
 * Backfill: if the user has pushed to fewer than `min` repos recently, we
 * top up with the highest-starred non-fork repos so we never send a
 * profile with zero repos to the grader.
 */
export function pickReposForScoring(
  repos: GHRepo[],
  opts: { recentDays?: number; min?: number; max?: number } = {},
): GHRepo[] {
  const recentDays = opts.recentDays ?? 90;
  const min = opts.min ?? 3;
  const max = opts.max ?? 12;
  const cutoff = Date.now() - recentDays * 86_400_000;

  const nonFork = repos.filter((r) => !r.fork);
  const recent = nonFork
    .filter((r) => new Date(r.pushed_at).getTime() >= cutoff)
    .sort(
      (a, b) =>
        new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
    );

  if (recent.length >= min) return recent.slice(0, max);

  // Not enough active work — backfill with historically starred repos.
  const recentNames = new Set(recent.map((r) => r.name));
  const backfill = nonFork
    .filter((r) => !recentNames.has(r.name))
    .sort((a, b) => b.stargazers_count - a.stargazers_count);

  const out = [...recent];
  for (const r of backfill) {
    if (out.length >= min) break;
    out.push(r);
  }
  return out.slice(0, max);
}

/** Kept as a thin alias for anything still calling the old name. */
export function pickTopRepos(repos: GHRepo[], n = 3): GHRepo[] {
  return pickReposForScoring(repos, { min: n, max: n });
}

// ---------------- Presence flags ----------------------------------------
/**
 * Cheap, deterministic detection of repo-craftsmanship signals from the
 * file tree + primary language. These are shown as authoritative flags in
 * the per-repo scoring prompt so the model doesn't hallucinate "no README"
 * when one exists etc.
 */
export type PresenceFlags = {
  hasReadme: boolean;
  hasTests: boolean;
  hasCI: boolean;
  hasLicense: boolean;
  hasGitignore: boolean;
  typedLang: boolean;
  /** Substantial alternate documentation beyond README.md — design.md,
   * docs/ folder, ARCHITECTURE/STATUS/PROJECT_STATE/etc., or ≥ 3 prose
   * markdown files at the repo root. For Quality scoring this counts as
   * "documented" even when hasReadme=false. */
  hasAlternateDocs: boolean;
};

const TYPED_LANGS = new Set([
  "typescript",
  "kotlin",
  "swift",
  "rust",
  "go",
  "java",
  "c#",
  "scala",
  "haskell",
  "ocaml",
  "f#",
]);

export function detectPresenceFlags(args: {
  tree: GHTreeItem[];
  readme: string | null;
  language: string | null;
}): PresenceFlags {
  const paths = args.tree.map((t) => t.path.toLowerCase());

  const hasTests = paths.some(
    (p) =>
      p.startsWith("test/") ||
      p.startsWith("tests/") ||
      p.includes("/__tests__/") ||
      p.startsWith("__tests__/") ||
      /\.test\.[a-z]+$/i.test(p) ||
      /\.spec\.[a-z]+$/i.test(p) ||
      p === "test.py" ||
      /_test\.go$/.test(p),
  );

  const hasCI = paths.some(
    (p) =>
      p.startsWith(".github/workflows/") ||
      p.startsWith(".circleci/") ||
      p === ".gitlab-ci.yml" ||
      p === ".travis.yml" ||
      p === "azure-pipelines.yml" ||
      p === ".drone.yml" ||
      p === "bitbucket-pipelines.yml",
  );

  const hasLicense = paths.some((p) =>
    /^(license|licence)(\.|$)/i.test(p),
  );

  const hasGitignore = paths.some((p) => p === ".gitignore");

  const lang = (args.language ?? "").toLowerCase();
  const typedLang =
    TYPED_LANGS.has(lang) || paths.some((p) => p === "tsconfig.json");

  // Alternate documentation — either a docs/ folder, a named design-ish
  // markdown (architecture/design/status/project-state/…), or ≥ 3 root-level
  // prose markdown files.
  const docishNames =
    /^(architecture|design|project[_-]?state|status|spec|api|idea|what[_-]is[_-]this|roadmap|notes)\.md$/i;
  const hasDocsDir = paths.some((p) => p.startsWith("docs/"));
  const hasNamedDoc = paths.some((p) => docishNames.test(p));
  const rootMarkdownCount = paths.filter(
    (p) => /\.md$/i.test(p) && !p.includes("/") && !/readme/i.test(p),
  ).length;
  const hasAlternateDocs = hasDocsDir || hasNamedDoc || rootMarkdownCount >= 3;

  return {
    hasReadme: !!(args.readme && args.readme.trim().length > 0),
    hasTests,
    hasCI,
    hasLicense,
    hasGitignore,
    typedLang,
    hasAlternateDocs,
  };
}
