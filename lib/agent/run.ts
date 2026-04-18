import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import {
  fetchContributions,
  fetchEvents,
  fetchFile,
  fetchReadme,
  fetchRepoCommits,
  fetchRepoTree,
  fetchRepos,
  fetchUser,
  type GHRepo,
  type GHTreeItem,
} from "@/lib/github/fetcher";
import {
  buildStats,
  detectPresenceFlags,
  pickReposForScoring,
  type PresenceFlags,
  type ProfileStats,
} from "@/lib/github/stats";
import {
  PASS_1_SYSTEM,
  PASS_2_SYSTEM,
  buildPass3System,
} from "./system-prompt";
import { wrapUntrusted } from "./wrap-untrusted";
import {
  RatingOutputSchema,
  type RatingOutput,
} from "@/lib/scoring/schema";
import { normalizeRatingOutput } from "@/lib/scoring/normalize";
import { tierForScore, weightedOverall } from "@/lib/scoring/rubric";

// ---------------------------------------------------------------------------
// Model routing (v3)
// ---------------------------------------------------------------------------
const MODEL_PASS_1 = "claude-sonnet-4-6"; // file selection
const MODEL_PASS_2 = "claude-haiku-4-5-20251001"; // per-repo scoring
const MODEL_PASS_3 = "claude-sonnet-4-6"; // profile aggregation

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------
const MAX_REPOS = 12;
const FILES_PER_REPO = 20; // v3: bumped from 8 — per-repo batching gives room
const MAX_FILE_CHARS = 12_000;
const MAX_README_CHARS = 4_000;
const MAX_FILE_TREE_PATHS = 400;
// Per-repo Pass 2 budget (input chars before tool schema + system prompt).
// Haiku 4.5 has a 200k window; we target ~140k tokens of input.
const PER_REPO_TRIM_CHARS = 400_000;
const PER_REPO_HARD_LIMIT_CHARS = 520_000;

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------
type Log = (stage: string, detail?: string) => void;
function makeLogger(login: string): Log {
  const started = Date.now();
  return (stage, detail) => {
    const secs = ((Date.now() - started) / 1000).toFixed(1);
    const tail = detail ? ` · ${detail}` : "";
    process.stdout.write(`[rmg][${login}] +${secs}s ${stage}${tail}\n`);
  };
}

// ---------------------------------------------------------------------------
// Usage + cost accounting. Anthropic's pricing as of Jan 2026 (per M tokens).
// If the pricing map misses a model, we fall back to Sonnet 4.x pricing as
// the conservative (higher) estimate so we never under-report cost.
// ---------------------------------------------------------------------------
const PRICING_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-opus-4-7": { input: 15, output: 75 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

type UsageBucket = {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreate: number;
  calls: number;
};
type UsageAccumulator = {
  record: (model: string, usage: Anthropic.Usage | undefined) => void;
  summary: () => {
    totalInput: number;
    totalOutput: number;
    totalCost: number;
    perModel: Array<{ model: string; bucket: UsageBucket; cost: number }>;
  };
};
function makeUsageAccumulator(): UsageAccumulator {
  const byModel = new Map<string, UsageBucket>();
  return {
    record(model, usage) {
      if (!usage) return;
      const b = byModel.get(model) ?? {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheCreate: 0,
        calls: 0,
      };
      b.input += usage.input_tokens ?? 0;
      b.output += usage.output_tokens ?? 0;
      b.cacheRead += usage.cache_read_input_tokens ?? 0;
      b.cacheCreate += usage.cache_creation_input_tokens ?? 0;
      b.calls += 1;
      byModel.set(model, b);
    },
    summary() {
      let totalInput = 0;
      let totalOutput = 0;
      let totalCost = 0;
      const perModel: Array<{ model: string; bucket: UsageBucket; cost: number }> = [];
      for (const [model, bucket] of byModel.entries()) {
        const p = PRICING_PER_MTOK[model] ?? PRICING_PER_MTOK["claude-sonnet-4-6"];
        // Cached input reads are priced at 10% of regular input on Anthropic.
        // We treat cache-creation writes as full price (they're only paid once).
        const cost =
          (bucket.input / 1_000_000) * p.input +
          (bucket.output / 1_000_000) * p.output +
          (bucket.cacheRead / 1_000_000) * p.input * 0.1 +
          (bucket.cacheCreate / 1_000_000) * p.input * 1.25;
        totalInput += bucket.input + bucket.cacheRead + bucket.cacheCreate;
        totalOutput += bucket.output;
        totalCost += cost;
        perModel.push({ model, bucket, cost });
      }
      return { totalInput, totalOutput, totalCost, perModel };
    },
  };
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type RunResult = {
  rating: RatingOutput;
  heatmapWindowDays: number;
};

type RepoBundle = {
  repo: GHRepo;
  tree: GHTreeItem[];
  readme: string | null;
  commits: Array<{ commit: { author?: { date: string } } }>;
  flags: PresenceFlags;
};

type PerRepoScore = {
  name: string;
  impact: number;
  quality: number;
  depth: number;
  summary: string;
  overallRepoScore: number;
  impactEvidence: string[];
  qualityEvidence: string[];
  depthEvidence: string[];
};

// ===========================================================================
// Tool schemas
// ===========================================================================
const SUBMIT_REPO_SCORE_TOOL: Anthropic.Tool = {
  name: "submit_repo_score",
  description:
    "Submit the final score for ONE GitHub repository. Calling this ends the per-repo rating. All fields are required.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "impact",
      "quality",
      "depth",
      "summary",
      "overallRepoScore",
      "impactEvidence",
      "qualityEvidence",
      "depthEvidence",
    ],
    properties: {
      impact: { type: "integer", minimum: 0, maximum: 100 },
      quality: { type: "integer", minimum: 0, maximum: 100 },
      depth: { type: "integer", minimum: 0, maximum: 100 },
      overallRepoScore: { type: "integer", minimum: 0, maximum: 100 },
      summary: { type: "string", minLength: 5, maxLength: 320 },
      impactEvidence: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string", minLength: 5, maxLength: 280 },
      },
      qualityEvidence: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string", minLength: 5, maxLength: 280 },
      },
      depthEvidence: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: { type: "string", minLength: 5, maxLength: 280 },
      },
    },
  },
};

const SUBMIT_RATING_TOOL: Anthropic.Tool = {
  name: "submit_rating",
  description:
    "Submit the final profile rating. Calling this ends the run. All fields are required.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "rubricVersion",
      "overallScore",
      "tier",
      "categoryScores",
      "categoryReasoning",
      "languages",
      "heatmap",
      "repos",
      "roasts",
      "timeline",
      "totals",
    ],
    properties: {
      rubricVersion: { type: "integer", enum: [2] },
      overallScore: { type: "number", minimum: 0, maximum: 100 },
      tier: { type: "string", enum: ["S", "A", "B", "C", "D", "F"] },
      categoryScores: {
        type: "object",
        additionalProperties: false,
        required: [
          "consistency",
          "impact",
          "quality",
          "breadth",
          "depth",
          "community",
        ],
        properties: {
          consistency: { type: "number", minimum: 0, maximum: 100 },
          impact: { type: "number", minimum: 0, maximum: 100 },
          quality: { type: "number", minimum: 0, maximum: 100 },
          breadth: { type: "number", minimum: 0, maximum: 100 },
          depth: { type: "number", minimum: 0, maximum: 100 },
          community: { type: "number", minimum: 0, maximum: 100 },
        },
      },
      categoryReasoning: {
        type: "object",
        additionalProperties: false,
        required: [
          "consistency",
          "impact",
          "quality",
          "breadth",
          "depth",
          "community",
        ],
        properties: {
          consistency: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string", minLength: 5, maxLength: 320 },
          },
          impact: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string", minLength: 5, maxLength: 320 },
          },
          quality: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string", minLength: 5, maxLength: 320 },
          },
          breadth: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string", minLength: 5, maxLength: 320 },
          },
          depth: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string", minLength: 5, maxLength: 320 },
          },
          community: {
            type: "array",
            minItems: 2,
            maxItems: 5,
            items: { type: "string", minLength: 5, maxLength: 320 },
          },
        },
      },
      languages: {
        type: "array",
        maxItems: 10,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["language", "pct"],
          properties: {
            language: { type: "string", minLength: 1, maxLength: 40 },
            pct: { type: "number", minimum: 0, maximum: 100 },
          },
        },
      },
      heatmap: {
        type: "array",
        minItems: 52,
        maxItems: 52,
        items: {
          type: "array",
          minItems: 7,
          maxItems: 7,
          items: { type: "integer", minimum: 0, maximum: 4 },
        },
      },
      repos: {
        type: "array",
        minItems: 1,
        maxItems: 12,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "language", "stars", "lastCommit", "score", "summary"],
          properties: {
            name: { type: "string", minLength: 1, maxLength: 100 },
            language: { type: "string", minLength: 1, maxLength: 40 },
            stars: { type: "integer", minimum: 0 },
            lastCommit: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}" },
            score: { type: "number", minimum: 0, maximum: 100 },
            summary: { type: "string", minLength: 5, maxLength: 320 },
          },
        },
      },
      roasts: {
        type: "array",
        minItems: 0,
        maxItems: 6,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "body", "flavor"],
          properties: {
            label: { type: "string", minLength: 1, maxLength: 60 },
            body: { type: "string", minLength: 5, maxLength: 320 },
            flavor: {
              type: "string",
              enum: ["red", "blue", "green", "yellow", "purple"],
            },
          },
        },
      },
      timeline: {
        type: "array",
        maxItems: 16,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["date", "label"],
          properties: {
            date: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}" },
            label: { type: "string", minLength: 3, maxLength: 200 },
            repo: { type: "string", maxLength: 100 },
          },
        },
      },
      totals: {
        type: "object",
        additionalProperties: false,
        required: ["repos", "commits", "followers"],
        properties: {
          repos: { type: "integer", minimum: 0 },
          commits: { type: "integer", minimum: 0 },
          followers: { type: "integer", minimum: 0 },
        },
      },
    },
  },
};

// ===========================================================================
// runAgent — three-pass orchestration
// ===========================================================================
export async function runAgent(login: string): Promise<RunResult> {
  const mode = process.env.AGENT_MODE ?? "auto";
  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const log = makeLogger(login);

  if (mode === "mock" || (mode === "auto" && !hasKey)) {
    log("mock-mode", "ANTHROPIC_API_KEY missing; returning deterministic stub");
    return { rating: mockRating(login), heatmapWindowDays: 365 };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
  const usage = makeUsageAccumulator();

  log("start");

  // ------- Cheap GitHub fan-out ------------------------------------------
  log("fetching user + repos + events + contributions in parallel");
  const [user, repos, events, contributions] = await Promise.all([
    fetchUser(login),
    fetchRepos(login),
    fetchEvents(login),
    fetchContributions(login),
  ]);
  log(
    "github-meta",
    `${repos.length} repos · ${events.length} events · user type=${user.type} · contributions=${
      contributions ? "ok" : "fallback"
    }`,
  );
  log(
    "all-repos",
    repos
      .map(
        (r) =>
          `${r.name}${r.fork ? "(fork)" : ""} ★${r.stargazers_count} push=${r.pushed_at.slice(0, 10)}`,
      )
      .join(" | "),
  );
  if (user.type !== "User") {
    throw new Error(`github.com/${login} is a ${user.type}, not a user.`);
  }

  const topRepos = pickReposForScoring(repos, {
    recentDays: 90,
    min: 3,
    max: MAX_REPOS,
  });
  log(
    "picked-repos",
    `${topRepos.length} total: ${topRepos
      .map((r) => `${r.name}(${r.stargazers_count}★)`)
      .join(", ")}`,
  );
  if (topRepos.length === 0) {
    throw new Error(`${login} has no non-fork repos to score.`);
  }

  // ------- Parallel per-repo: tree + readme + commits --------------------
  const bundleStart = Date.now();
  const repoBundles: RepoBundle[] = await Promise.all(
    topRepos.map(async (repo) => {
      const [tree, readme, commits] = await Promise.all([
        fetchRepoTree(login, repo.name, repo.default_branch).catch(() => []),
        fetchReadme(login, repo.name),
        fetchRepoCommits(login, repo.name),
      ]);
      return {
        repo,
        tree,
        readme: (readme ?? "").slice(0, MAX_README_CHARS) || null,
        commits,
        flags: detectPresenceFlags({
          tree,
          readme,
          language: repo.language,
        }),
      };
    }),
  );
  log(
    "bundles",
    `fetched trees+READMEs in ${((Date.now() - bundleStart) / 1000).toFixed(1)}s`,
  );

  const commitsByRepo = new Map(
    repoBundles.map((b) => [b.repo.name, b.commits.length]),
  );

  // ------- Server-computed stats -----------------------------------------
  const stats = buildStats({ user, repos, events, commitsByRepo, contributions });
  log(
    "stats",
    `heatmap-window=${stats.heatmapWindowDays}d · commits-yr=${stats.totalCommitsYear ?? "n/a"} · prs-yr=${stats.totalPRsYear ?? "n/a"} · nightOwl=${stats.nightOwlPct}% · solo=${stats.soloPct}% · langs=${stats.langPcts.length} · joined=${stats.githubJoinedAt?.slice(0, 10) ?? "?"} · staleRepoRatio=${stats.staleRepoRatio} · multiRepoVolume=${stats.multiRepoVolume} · privateWorkLikely=${stats.privateWorkLikely}`,
  );

  // ------- Pass 1 — file selection (Sonnet) ------------------------------
  const pass1Input = formatPass1Input(
    login,
    repoBundles.map((b) => ({
      name: b.repo.name,
      tree: pruneTree(b.tree),
      readme: b.readme ?? "",
    })),
  );
  log(
    "pass1-send",
    `${(pass1Input.length / 1024).toFixed(1)} KB prompt → ${MODEL_PASS_1}`,
  );
  const pass1Start = Date.now();
  const selection = await pass1(client, pass1Input, usage);
  log(
    "pass1-done",
    `picked ${selection.selections.reduce((a, s) => a + s.files.length, 0)} files in ${((Date.now() - pass1Start) / 1000).toFixed(1)}s`,
  );

  // ------- Fetch selected files (parallel) ------------------------------
  const filesByRepo = new Map<string, Array<{ path: string; content: string }>>();
  const fileStart = Date.now();
  await Promise.all(
    selection.selections.map(async (s) => {
      const bundle = repoBundles.find((b) => b.repo.name === s.repo);
      if (!bundle) return;
      const branch = bundle.repo.default_branch;
      const picked = s.files.slice(0, FILES_PER_REPO);
      const files = await Promise.all(
        picked.map(async (path) => {
          const content = await fetchFile(login, s.repo, path, branch);
          return content
            ? { path, content: content.slice(0, MAX_FILE_CHARS) }
            : null;
        }),
      );
      filesByRepo.set(
        s.repo,
        files.filter((f): f is { path: string; content: string } => !!f),
      );
    }),
  );
  const totalFiles = Array.from(filesByRepo.values()).reduce(
    (a, f) => a + f.length,
    0,
  );
  log(
    "files-fetched",
    `${totalFiles} file(s) in ${((Date.now() - fileStart) / 1000).toFixed(1)}s`,
  );

  // ------- Pass 2 — per-repo scoring (Haiku, parallel) -------------------
  log("pass2-start", `${repoBundles.length} parallel Haiku calls`);
  const pass2Start = Date.now();
  const perRepoResults: Array<{
    bundle: RepoBundle;
    result: PerRepoScore | null;
    error: string | null;
  }> = await Promise.all(
    repoBundles.map(async (b) => {
      try {
        const files = filesByRepo.get(b.repo.name) ?? [];
        const input = formatPass2RepoInput({
          repo: b.repo,
          readme: b.readme ?? "",
          flags: b.flags,
          files: trimRepoFilesToBudget(b.readme ?? "", files),
          commitCountSample: commitsByRepo.get(b.repo.name) ?? 0,
        });
        const result = await pass2Repo(client, input, usage);
        return { bundle: b, result: { ...result, name: b.repo.name }, error: null };
      } catch (err) {
        return {
          bundle: b,
          result: null,
          error: (err as Error).message,
        };
      }
    }),
  );
  const pass2Duration = ((Date.now() - pass2Start) / 1000).toFixed(1);
  const pass2Ok = perRepoResults.filter((r) => r.result).length;
  const pass2Err = perRepoResults.filter((r) => r.error);
  log(
    "pass2-done",
    `${pass2Ok}/${repoBundles.length} repos scored in ${pass2Duration}s`,
  );
  if (pass2Err.length > 0) {
    log(
      "pass2-errors",
      pass2Err
        .map((r) => `${r.bundle.repo.name}: ${r.error}`)
        .join(" | "),
    );
  }

  // If every Pass 2 failed, we can't score — surface it.
  const successfulRepos = perRepoResults
    .map((r) => r.result)
    .filter((r): r is PerRepoScore => r !== null);
  if (successfulRepos.length === 0) {
    throw new Error(
      `All ${repoBundles.length} per-repo scoring calls failed. First error: ${pass2Err[0]?.error ?? "unknown"}`,
    );
  }

  // ------- Pass 3 — profile aggregation (Sonnet) -------------------------
  const pass3Input = formatPass3Input({
    user,
    stats,
    perRepoScores: successfulRepos,
    bundles: repoBundles,
  });
  log(
    "pass3-send",
    `${(pass3Input.length / 1024).toFixed(1)} KB prompt → ${MODEL_PASS_3}`,
  );
  const pass3Start = Date.now();
  const rating = await pass3(
    client,
    pass3Input,
    log,
    {
      heatmap: stats.heatmap,
      langPcts: stats.langPcts,
      login,
    },
    usage,
  );
  log(
    "pass3-done",
    `overall=${rating.overallScore} tier=${rating.tier} in ${((Date.now() - pass3Start) / 1000).toFixed(1)}s`,
  );

  // -- Deterministic anchor enforcement ---------------------------------
  // All corrections below are triggered only by SERVER-MEASURED signals
  // (privateWorkLikely, multiRepoVolume, follower count, anchor matches)
  // and by PASS 2's per-repo scores (successfulRepos) — NOT the model's
  // Pass-3 rating.repos, which can reshape what Pass 2 actually emitted.
  const before = { ...rating.categoryScores };

  // Apply per-repo Quality bumps to the authoritative Pass 2 results first.
  // These are then used for aggregation below.
  const bumpedPerRepo = successfulRepos.map((pr) => {
    const bundle = repoBundles.find((b) => b.repo.name === pr.name);
    if (!bundle) return pr;
    const flags = bundle.flags;
    const bigCodebase = bundle.tree.length >= 300 || bundle.repo.size >= 10_000;
    const isDocumented = flags.hasReadme || flags.hasAlternateDocs;
    let quality = pr.quality;
    if (isDocumented && flags.typedLang && bigCodebase && quality < 55) {
      quality = 55;
    } else if (isDocumented && flags.typedLang && quality < 50) {
      quality = 50;
    }
    return { ...pr, quality };
  });

  // Per-repo Impact floor for real projects in a portfolio.
  const realProjects = bumpedPerRepo.filter(
    (r) => r.overallRepoScore >= 25,
  ).length;
  const bumpedWithImpact = bumpedPerRepo.map((pr) => {
    let impact = pr.impact;
    if (realProjects >= 3 && pr.overallRepoScore >= 30 && impact < 30) {
      impact = 30;
    }
    return { ...pr, impact };
  });

  // Impact profile = MAX per-repo Impact (with floors applied).
  const perRepoImpacts = bumpedWithImpact.map((r) => r.impact);
  const perRepoQualities = bumpedWithImpact.map((r) => r.quality);
  const perRepoDepths = bumpedWithImpact.map((r) => r.depth);

  if (perRepoImpacts.length > 0) {
    const maxImpact = Math.max(...perRepoImpacts);
    if (maxImpact > rating.categoryScores.impact) {
      rating.categoryScores.impact = maxImpact;
    }
  }
  if (perRepoDepths.length > 0) {
    const maxDepth = Math.max(...perRepoDepths);
    if (maxDepth > rating.categoryScores.depth) {
      rating.categoryScores.depth = maxDepth;
    }
  }

  // Quality profile: weighted mean by log10(1+stars) + recency tier,
  // computed over the bumped Pass 2 scores.
  if (perRepoQualities.length > 0) {
    let num = 0;
    let den = 0;
    for (const pr of bumpedWithImpact) {
      const src = repos.find((rr) => rr.name === pr.name);
      const stars = src?.stargazers_count ?? 0;
      const ageDays = src
        ? (Date.now() - new Date(src.pushed_at).getTime()) / 86_400_000
        : 365;
      const recency =
        ageDays <= 30 ? 10 : ageDays <= 90 ? 6 : ageDays <= 365 ? 3 : 1;
      const w = Math.log10(1 + stars) * 4 + recency;
      num += pr.quality * w;
      den += w;
    }
    if (den > 0) {
      const weightedQ = num / den;
      if (weightedQ > rating.categoryScores.quality) {
        rating.categoryScores.quality = Math.round(weightedQ);
      }
    }
    // Flagship override: profile Quality shouldn't lag more than 3 points
    // behind the best per-repo Quality. Stops weighted-mean-with-low-tail
    // from dragging legitimate flagships down.
    const topQ = Math.max(...perRepoQualities);
    if (topQ >= 55 && rating.categoryScores.quality < topQ - 3) {
      rating.categoryScores.quality = topQ - 3;
    }
  }

  // Mirror the bumped per-repo scores back into rating.repos so the UI
  // reflects them. The reconciliation step later still runs on this data.
  const bumpedByName = new Map(bumpedWithImpact.map((r) => [r.name, r]));
  for (const r of rating.repos) {
    const b = bumpedByName.get(r.name);
    if (!b) continue;
    if (typeof r.quality === "number" && b.quality > r.quality) r.quality = b.quality;
    if (typeof r.impact === "number" && b.impact > r.impact) r.impact = b.impact;
  }

  // Consistency correction: privateWorkLikely implies ≥ 55
  if (stats.privateWorkLikely && rating.categoryScores.consistency < 55) {
    rating.categoryScores.consistency = 55;
  }
  // Consistency multiRepoVolume tiers (lowered thresholds — 96 was just
  // under the old 100, which is silly for a clearly-active builder)
  if (stats.multiRepoVolume >= 130 && rating.categoryScores.consistency < 65) {
    rating.categoryScores.consistency = 65;
  } else if (
    stats.multiRepoVolume >= 90 &&
    rating.categoryScores.consistency < 60
  ) {
    rating.categoryScores.consistency = 60;
  } else if (
    stats.multiRepoVolume >= 60 &&
    rating.categoryScores.consistency < 55
  ) {
    rating.categoryScores.consistency = 55;
  }

  // Depth horizontal-output correction (lowered thresholds)
  if (stats.multiRepoVolume >= 130 && rating.categoryScores.depth < 58) {
    rating.categoryScores.depth = 58;
  } else if (
    stats.multiRepoVolume >= 90 &&
    rating.categoryScores.depth < 55
  ) {
    rating.categoryScores.depth = 55;
  } else if (
    stats.multiRepoVolume >= 60 &&
    rating.categoryScores.depth < 50
  ) {
    rating.categoryScores.depth = 50;
  }

  // Impact portfolio floors — tiered by how many real projects the owner
  // has active. This is what "active portfolio" impact looks like for an
  // indie shipper whose individual repo stars are low but whose breadth
  // of shipped products is high.
  if (realProjects >= 4 && rating.categoryScores.impact < 48) {
    rating.categoryScores.impact = 48;
  }
  if (realProjects >= 6 && rating.categoryScores.impact < 56) {
    rating.categoryScores.impact = 56;
  }
  if (realProjects >= 8 && rating.categoryScores.impact < 62) {
    rating.categoryScores.impact = 62;
  }
  if (realProjects >= 10 && rating.categoryScores.impact < 68) {
    rating.categoryScores.impact = 68;
  }

  // Community follower-count floor — scaled to real follower tiers.
  if (user.followers >= 50_000 && rating.categoryScores.community < 90) {
    rating.categoryScores.community = 90;
  } else if (
    user.followers >= 5_000 &&
    rating.categoryScores.community < 75
  ) {
    rating.categoryScores.community = 75;
  } else if (
    user.followers >= 500 &&
    rating.categoryScores.community < 55
  ) {
    rating.categoryScores.community = 55;
  }
  // Active-shipping community floor — for builders with few followers but
  // a clear shipping pattern, active-portfolio IS community presence.
  if (
    user.followers >= 10 &&
    realProjects >= 3 &&
    rating.categoryScores.community < 40
  ) {
    rating.categoryScores.community = 40;
  }
  if (
    user.followers >= 10 &&
    realProjects >= 6 &&
    rating.categoryScores.community < 50
  ) {
    rating.categoryScores.community = 50;
  }
  if (
    user.followers >= 10 &&
    realProjects >= 8 &&
    rating.categoryScores.community < 55
  ) {
    rating.categoryScores.community = 55;
  }

  const adjustedCats = (
    ["consistency", "impact", "quality", "depth", "breadth", "community"] as const
  ).filter((k) => before[k] !== rating.categoryScores[k]);
  if (adjustedCats.length > 0) {
    log(
      "anchor-corrections",
      adjustedCats
        .map((k) => `${k}: ${before[k]} → ${rating.categoryScores[k]}`)
        .join(" · "),
    );
  }

  // Defense: recompute overall from corrected category scores; re-tier.
  const recomputed = weightedOverall(rating.categoryScores);
  if (Math.abs(recomputed - rating.overallScore) > 0.5) {
    log(
      "recomputed-score",
      `model said ${rating.overallScore}, weights say ${recomputed}`,
    );
    rating.overallScore = recomputed;
  }
  const expectedTier = tierForScore(rating.overallScore).tier;
  if (rating.tier !== expectedTier) {
    log("retiered", `${rating.tier} → ${expectedTier}`);
    rating.tier = expectedTier;
  }

  // Server-forced totals (commits = GraphQL truth, not model estimate).
  const ownedNonForkCount = repos.filter((r) => !r.fork).length;
  rating.totals = {
    repos: ownedNonForkCount,
    commits: stats.totalCommitsYear ?? rating.totals.commits,
    followers: user.followers,
  };

  // Reconcile rating.repos with per-repo results — every analyzed repo
  // appears, using the per-repo scores as the source of truth.
  const perRepoByName = new Map(successfulRepos.map((r) => [r.name, r]));
  const modelReposByName = new Map(
    (rating.repos ?? []).map((r) => [r.name, r]),
  );
  rating.repos = topRepos.map((r) => {
    const pr = perRepoByName.get(r.name);
    const mr = modelReposByName.get(r.name);
    const lastCommit = r.pushed_at.slice(0, 10);
    const bundle = repoBundles.find((b) => b.repo.name === r.name);
    if (pr) {
      return {
        name: r.name,
        language: r.language ?? "Unknown",
        stars: r.stargazers_count,
        lastCommit,
        score: pr.overallRepoScore,
        summary: pr.summary,
        impact: pr.impact,
        quality: pr.quality,
        depth: pr.depth,
        impactEvidence: pr.impactEvidence,
        qualityEvidence: pr.qualityEvidence,
        depthEvidence: pr.depthEvidence,
        flags: bundle?.flags,
      };
    }
    // Per-repo call failed — fall back to a generic entry (still real data).
    return {
      name: r.name,
      language: r.language ?? "Unknown",
      stars: r.stargazers_count,
      lastCommit,
      score: mr?.score ?? Math.max(30, Math.round(rating.overallScore - 12)),
      summary:
        mr?.summary ??
        (r.description?.trim() ||
          `Last pushed ${lastCommit} · ${r.stargazers_count}★ · ${r.size} KB`).slice(0, 320),
      flags: bundle?.flags,
    };
  });
  rating.repos.sort((a, b) => b.score - a.score);

  // Deterministic timeline: "Joined GitHub" + repo creations + most recent push.
  const timelineEntries: Array<{ date: string; label: string; repo?: string }> = [];
  timelineEntries.push({
    date: user.created_at.slice(0, 10),
    label: "Joined GitHub",
  });
  const sortedByCreation = [...topRepos].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );
  for (const r of sortedByCreation) {
    timelineEntries.push({
      date: r.created_at.slice(0, 10),
      label: r.description
        ? `Created ${r.name} — ${r.description.slice(0, 180)}`
        : `Created ${r.name}`,
      repo: r.name,
    });
  }
  const mostRecent = [...topRepos].sort(
    (a, b) =>
      new Date(b.pushed_at).getTime() - new Date(a.pushed_at).getTime(),
  )[0];
  if (mostRecent) {
    timelineEntries.push({
      date: mostRecent.pushed_at.slice(0, 10),
      label: `Most recent push to ${mostRecent.name}`,
      repo: mostRecent.name,
    });
  }
  rating.timeline = timelineEntries.slice(0, 16);

  log(
    "totals-override",
    `repos=${rating.totals.repos} commits=${rating.totals.commits} followers=${rating.totals.followers} · final repo cards=${rating.repos.length} · timeline entries=${rating.timeline.length}`,
  );

  // -- Cost accounting ----------------------------------------------------
  const { totalInput, totalOutput, totalCost, perModel } = usage.summary();
  for (const m of perModel) {
    log(
      "tokens-per-model",
      `${m.model} · ${m.bucket.calls} calls · ${m.bucket.input.toLocaleString()} in / ${m.bucket.output.toLocaleString()} out · $${m.cost.toFixed(4)}`,
    );
  }
  log(
    "tokens-total",
    `${totalInput.toLocaleString()} in / ${totalOutput.toLocaleString()} out · $${totalCost.toFixed(4)} estimated for ${login}`,
  );

  log("done");
  return { rating, heatmapWindowDays: stats.heatmapWindowDays };
}

// ===========================================================================
// Pass 1 — file selection
// ===========================================================================
async function pass1(
  client: Anthropic,
  userMessage: string,
  usage: UsageAccumulator,
): Promise<{ selections: Array<{ repo: string; files: string[] }> }> {
  const resp = await client.messages.create({
    model: MODEL_PASS_1,
    max_tokens: 2048,
    system: PASS_1_SYSTEM,
    messages: [{ role: "user", content: userMessage }],
  });
  usage.record(MODEL_PASS_1, resp.usage);
  const text = resp.content
    .filter((c): c is Anthropic.TextBlock => c.type === "text")
    .map((c) => c.text)
    .join("\n")
    .trim();
  const json = safeExtractJson(text);
  if (!json || !Array.isArray((json as { selections?: unknown }).selections)) {
    throw new Error(`Pass 1 returned unexpected shape: ${text.slice(0, 400)}`);
  }
  return json as { selections: Array<{ repo: string; files: string[] }> };
}

// ===========================================================================
// Pass 2 — per-repo scoring (one Haiku call per repo)
// ===========================================================================
async function pass2Repo(
  client: Anthropic,
  userMessage: string,
  usage: UsageAccumulator,
): Promise<Omit<PerRepoScore, "name">> {
  const resp = await client.messages.create({
    model: MODEL_PASS_2,
    max_tokens: 2048,
    system: PASS_2_SYSTEM,
    tools: [SUBMIT_REPO_SCORE_TOOL],
    tool_choice: { type: "tool", name: "submit_repo_score" },
    messages: [{ role: "user", content: userMessage }],
  });
  usage.record(MODEL_PASS_2, resp.usage);
  const toolUse = resp.content.find(
    (c): c is Anthropic.ToolUseBlock =>
      c.type === "tool_use" && c.name === "submit_repo_score",
  );
  if (!toolUse) {
    throw new Error(
      `Pass 2 did not emit submit_repo_score. Stop=${resp.stop_reason}.`,
    );
  }
  const raw = toolUse.input as Record<string, unknown>;
  const clamp = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  const clampEvidence = (v: unknown): string[] =>
    Array.isArray(v)
      ? v
          .filter((x) => typeof x === "string" && x.length >= 5)
          .map((x) => (x as string).slice(0, 280))
          .slice(0, 5)
      : [];
  return {
    impact: clamp(raw.impact),
    quality: clamp(raw.quality),
    depth: clamp(raw.depth),
    overallRepoScore: clamp(raw.overallRepoScore),
    summary: (typeof raw.summary === "string" ? raw.summary : "No summary.").slice(0, 320),
    impactEvidence: clampEvidence(raw.impactEvidence),
    qualityEvidence: clampEvidence(raw.qualityEvidence),
    depthEvidence: clampEvidence(raw.depthEvidence),
  };
}

// ===========================================================================
// Pass 3 — profile aggregation (Sonnet)
// ===========================================================================
async function pass3(
  client: Anthropic,
  userMessage: string,
  log: Log,
  normalizeFallback: {
    heatmap: number[][];
    langPcts: Array<{ language: string; pct: number }>;
    login: string;
  },
  usage: UsageAccumulator,
): Promise<RatingOutput> {
  const resp = await client.messages.create({
    model: MODEL_PASS_3,
    max_tokens: 8192,
    system: buildPass3System(),
    tools: [SUBMIT_RATING_TOOL],
    tool_choice: { type: "tool", name: "submit_rating" },
    messages: [{ role: "user", content: userMessage }],
  });
  usage.record(MODEL_PASS_3, resp.usage);
  const toolUse = resp.content.find(
    (c): c is Anthropic.ToolUseBlock =>
      c.type === "tool_use" && c.name === "submit_rating",
  );
  if (!toolUse) {
    const textDump = resp.content
      .filter((c): c is Anthropic.TextBlock => c.type === "text")
      .map((c) => c.text)
      .join("")
      .slice(0, 800);
    throw new Error(
      `Pass 3 did not emit submit_rating. Stop=${resp.stop_reason}. Text: ${textDump}`,
    );
  }
  const normalized = normalizeRatingOutput(toolUse.input, normalizeFallback);
  const parsed = RatingOutputSchema.safeParse(normalized);
  if (!parsed.success) {
    log("pass3-bad-shape-raw", JSON.stringify(toolUse.input).slice(0, 600));
    log("pass3-bad-shape-norm", JSON.stringify(normalized).slice(0, 600));
    throw new Error(
      `Pass 3 output failed schema validation: ${parsed.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; ")}`,
    );
  }
  return parsed.data;
}

// ===========================================================================
// Helpers
// ===========================================================================
function safeExtractJson(text: string): Record<string, unknown> | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

function pruneTree(tree: GHTreeItem[]): string[] {
  const skip = /^(node_modules|dist|build|out|\.next|vendor|coverage|\.git)\//;
  const paths = tree
    .filter((t) => t.type === "blob")
    .map((t) => t.path)
    .filter((p) => !skip.test(p));
  return paths.slice(0, MAX_FILE_TREE_PATHS);
}

function trimRepoFilesToBudget(
  readme: string,
  files: Array<{ path: string; content: string }>,
): Array<{ path: string; content: string }> {
  const total =
    readme.length + files.reduce((a, f) => a + f.content.length, 0);
  if (total <= PER_REPO_TRIM_CHARS) return files;
  const scale = (PER_REPO_TRIM_CHARS / total) * 0.95;
  return files.map((f) => ({
    path: f.path,
    content: f.content.slice(
      0,
      Math.max(300, Math.floor(f.content.length * scale)),
    ),
  }));
}

function formatPass1Input(
  login: string,
  repos: Array<{ name: string; tree: string[]; readme: string }>,
): string {
  const sections = repos.map(
    (r) =>
      `## Repo: ${r.name}\n` +
      `${wrapUntrusted("readme", r.readme)}\n\n` +
      "### File tree\n" +
      r.tree.join("\n"),
  );
  return (
    `Target user: ${login}\n\n` +
    sections.join("\n\n---\n\n") +
    "\n\nReturn ONLY the JSON object described in the system prompt."
  );
}

function formatPass2RepoInput(args: {
  repo: GHRepo;
  readme: string;
  flags: PresenceFlags;
  files: Array<{ path: string; content: string }>;
  commitCountSample: number;
}): string {
  const r = args.repo;
  const f = args.flags;
  const yn = (b: boolean) => (b ? "yes" : "no");
  const header = `
## Repo: ${r.full_name}
stars: ${r.stargazers_count}
forks: ${r.forks_count}
watchers: ${r.watchers_count}
language: ${r.language ?? "Unknown"}
license: ${r.license?.spdx_id ?? "none"}
size_kb: ${r.size}
created: ${r.created_at}
last_push: ${r.pushed_at}
recent_commit_sample: ${args.commitCountSample} of last 30
description: ${r.description ?? "(none)"}

=== AUTHORITATIVE PRESENCE FLAGS ===
HAS_README:          ${yn(f.hasReadme)}
HAS_ALTERNATE_DOCS:  ${yn(f.hasAlternateDocs)} (docs/ folder, design.md,
                      ARCHITECTURE.md, STATUS.md, etc. — counts as
                      "documented" even when HAS_README=no)
IS_DOCUMENTED:       ${yn(f.hasReadme || f.hasAlternateDocs)}
HAS_TESTS:           ${yn(f.hasTests)}
HAS_CI:              ${yn(f.hasCI)}
HAS_LICENSE:         ${yn(f.hasLicense)}
HAS_GITIGNORE:       ${yn(f.hasGitignore)}
TYPED_LANG:          ${yn(f.typedLang)}
`.trim();

  const readmeSection = f.hasReadme
    ? `### README CONTENT (trust the flag above — this repo HAS a README)\n${wrapUntrusted("readme", args.readme)}`
    : `### README\nHAS_README=no — this repo does not have a README file.`;

  const fileDump = args.files.length
    ? args.files
        .map((x) => `#### ${x.path}\n${wrapUntrusted("source", x.content)}`)
        .join("\n\n")
    : "### FILES\n(no files fetched for this repo)";

  return [
    header,
    readmeSection,
    "=== SOURCE FILES SAMPLED ===",
    fileDump,
    "Call submit_repo_score with your scores for THIS repo only. Evidence bullets must cite specific files, numbers, or named artifacts.",
  ].join("\n\n");
}

function formatPass3Input(args: {
  user: {
    login: string;
    name: string | null;
    bio: string | null;
    followers: number;
    following: number;
    public_repos: number;
    created_at: string;
  };
  stats: ProfileStats;
  perRepoScores: PerRepoScore[];
  bundles: RepoBundle[];
}): string {
  const statsBlock = `
## Server-computed stats (AUTHORITATIVE — do not second-guess)
- nightOwlPct: ${args.stats.nightOwlPct}
- soloPct: ${args.stats.soloPct}
- totalStars: ${args.stats.totalStars}
- totalForks: ${args.stats.totalForks}
- mostRecentPush: ${args.stats.mostRecentPush ?? "unknown"}
- domainGuess: ${args.stats.domainGuess}
- githubJoinedAt: ${args.stats.githubJoinedAt}
- totalCommitsYear: ${args.stats.totalCommitsYear ?? "n/a"}
- totalPRsYear: ${args.stats.totalPRsYear ?? "n/a"}
- totalIssuesYear: ${args.stats.totalIssuesYear ?? "n/a"}
- staleRepoRatio: ${args.stats.staleRepoRatio} (fraction of owned repos last pushed > 2 years ago; high = genuinely abandoned old work; low = active account)
- multiRepoVolume: ${args.stats.multiRepoVolume} (sum of recent-commit samples across analyzed repos — horizontal depth proxy)
- privateWorkLikely: ${args.stats.privateWorkLikely} (when true, public counts are known to UNDERSTATE real activity; apply the Consistency correction rule)
- langPcts: ${JSON.stringify(args.stats.langPcts)}
- heatmap: ${JSON.stringify(args.stats.heatmap)}
`.trim();

  const userBlock = `
## User metadata
login: ${args.user.login}
name: ${args.user.name ?? ""}
bio: ${args.user.bio ?? ""}
followers: ${args.user.followers}
following: ${args.user.following}
public_repos: ${args.user.public_repos}
joined: ${args.user.created_at}
`.trim();

  const perRepoBlock = `
## Per-repo scores (from Pass 2, AUTHORITATIVE for per-repo dimensions)
${args.perRepoScores
  .map((r) => {
    const bundle = args.bundles.find((b) => b.repo.name === r.name);
    const flagsLine = bundle
      ? `flags: README=${bundle.flags.hasReadme ? "yes" : "no"} TESTS=${bundle.flags.hasTests ? "yes" : "no"} CI=${bundle.flags.hasCI ? "yes" : "no"} TYPED=${bundle.flags.typedLang ? "yes" : "no"}`
      : "flags: unknown";
    return `
### ${r.name}
${flagsLine}
impact=${r.impact}  quality=${r.quality}  depth=${r.depth}  overall=${r.overallRepoScore}
summary: ${r.summary}
impactEvidence:
${r.impactEvidence.map((e) => `- ${e}`).join("\n")}
qualityEvidence:
${r.qualityEvidence.map((e) => `- ${e}`).join("\n")}
depthEvidence:
${r.depthEvidence.map((e) => `- ${e}`).join("\n")}
`.trim();
  })
  .join("\n\n")}
`.trim();

  return [
    userBlock,
    statsBlock,
    perRepoBlock,
    "Call submit_rating. Aggregate Impact/Quality/Depth from per-repo scores as described in the system prompt. Compute Consistency/Breadth/Community from the stats above. categoryReasoning must cite specific per-repo evidence and stats numbers.",
  ].join("\n\n");
}

// ===========================================================================
// Deterministic mock for local demos without ANTHROPIC_API_KEY.
// ===========================================================================
function mockRating(login: string): RatingOutput {
  const seed = hash(login.toLowerCase());
  const rand = mulberry32(seed);
  const between = (lo: number, hi: number) =>
    Math.round(lo + rand() * (hi - lo));

  const categoryScores = {
    consistency: between(35, 95),
    impact: between(10, 95),
    quality: between(40, 92),
    breadth: between(30, 90),
    depth: between(25, 90),
    community: between(10, 85),
  };
  const overall = weightedOverall(categoryScores);
  const tier = tierForScore(overall).tier;

  const langs = ["TypeScript", "Python", "Go", "Rust", "C", "Swift"];
  const shuffled = [...langs].sort(() => rand() - 0.5).slice(0, 4);
  const pcts = (() => {
    const raw = shuffled.map(() => 1 + rand() * 3);
    const s = raw.reduce((a, b) => a + b, 0);
    return raw.map((v) => Math.round((v / s) * 100));
  })();

  return {
    rubricVersion: 2,
    overallScore: overall,
    tier,
    categoryScores,
    languages: shuffled.map((l, i) => ({ language: l, pct: pcts[i] })),
    heatmap: mockHeatmap(rand),
    repos: Array.from({ length: 5 }).map((_, i) => ({
      name: `${login}-project-${i + 1}`,
      language: shuffled[i % shuffled.length],
      stars: Math.floor(rand() * 2000),
      lastCommit: new Date(Date.now() - Math.floor(rand() * 600) * 86_400_000)
        .toISOString()
        .slice(0, 10),
      score: between(30, 95),
      summary: `A mock ${shuffled[i % shuffled.length]} project. Set ANTHROPIC_API_KEY to run the real grader.`,
    })),
    roasts: [
      { label: "Mock Mode", body: "Set ANTHROPIC_API_KEY to get real roasts.", flavor: "yellow" },
      { label: "Dev Build", body: `Deterministic per login (${login}).`, flavor: "blue" },
    ],
    timeline: [
      { date: new Date().toISOString().slice(0, 10), label: `Mock rating for ${login}` },
    ],
    totals: {
      repos: Math.floor(rand() * 60) + 5,
      commits: Math.floor(rand() * 20_000),
      followers: Math.floor(rand() * 5000),
    },
    categoryReasoning: {
      consistency: ["mock mode — no real evidence available"],
      impact: ["mock mode — set ANTHROPIC_API_KEY to see real evidence"],
      quality: ["mock mode — real evidence appears after a live rating"],
      breadth: ["mock mode"],
      depth: ["mock mode"],
      community: ["mock mode"],
    },
  };
}

function mockHeatmap(rand: () => number) {
  const weeks: number[][] = [];
  for (let w = 0; w < 52; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const r = rand();
      const boost = w / 60;
      if (r > 0.55 - boost) week.push(0);
      else if (r > 0.3) week.push(1);
      else if (r > 0.15) week.push(2);
      else if (r > 0.07) week.push(3);
      else week.push(4);
    }
    weeks.push(week);
  }
  return weeks;
}
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Unused but referenced — retained for backwards compatibility with any other
// callers. Noop since per-repo trimming is handled inline now.
export const _reserved = { PER_REPO_HARD_LIMIT_CHARS };
