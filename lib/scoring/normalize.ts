import { CATEGORIES, RUBRIC_VERSION, tierForScore, type CategoryKey } from "./rubric";

/**
 * Coerce a best-effort rating payload into the shape RatingOutputSchema
 * expects. Model output can drift — we'd rather silently repair small shape
 * issues than reject the whole rating and fail the user's session.
 *
 * Fixes applied, in order:
 *   • unknown or missing fields filled with safe defaults
 *   • heatmap padded/trimmed to 52×7 with values clamped 0–4
 *   • numeric scores clamped to [0, 100]
 *   • arrays truncated to max length; empty arrays backfilled with a stub so
 *     the schema's min(1) on repos still passes
 *   • tier forced to match the overall score (belt-and-suspenders with the
 *     server recompute in run.ts)
 */
export function normalizeRatingOutput(
  raw: unknown,
  fallback: { heatmap: number[][]; langPcts: Array<{ language: string; pct: number }>; login: string },
): Record<string, unknown> {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const clampedScore = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : 0;
  const asString = (v: unknown, fallback = "") =>
    typeof v === "string" ? v : fallback;
  const asInt = (v: unknown, fallback = 0) =>
    typeof v === "number" && Number.isFinite(v) ? Math.max(0, Math.floor(v)) : fallback;
  const asArray = <T>(v: unknown, fallback: T[]): T[] =>
    Array.isArray(v) ? (v as T[]) : fallback;

  // ---- categoryScores: ensure every key present -------------------------
  const rawCats = (obj.categoryScores ?? {}) as Record<string, unknown>;
  const categoryScores = Object.fromEntries(
    CATEGORIES.map((c) => [c.key, clampedScore(rawCats[c.key])]),
  ) as Record<CategoryKey, number>;

  // ---- overall + tier: use the model's if present, else compute ---------
  const overallScore = clampedScore(obj.overallScore ?? 0);

  // ---- heatmap: 52×7, ints 0–4 ------------------------------------------
  const rawHeatmap = asArray<unknown[]>(obj.heatmap, fallback.heatmap as unknown as unknown[][]);
  const heatmap = normalizeGrid(rawHeatmap, fallback.heatmap);

  // ---- languages: accept the server langPcts as source of truth ----------
  const languages = (asArray<{ language?: unknown; pct?: unknown }>(obj.languages, []).map((l) => ({
    language: asString(l?.language, "Unknown").slice(0, 60) || "Unknown",
    pct: clampedScore(l?.pct),
  })).filter((l) => l.language && l.pct >= 0) as Array<{ language: string; pct: number }>)
    .slice(0, 10);
  const finalLanguages = languages.length > 0 ? languages : fallback.langPcts;

  // ---- repos: must have at least 1 ---------------------------------------
  const reposRaw = asArray<Record<string, unknown>>(obj.repos, []);
  const normalizeEvidence = (v: unknown): string[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const out = v
      .filter((x) => typeof x === "string" && x.length >= 5)
      .map((x) => (x as string).slice(0, 280))
      .slice(0, 5);
    return out.length > 0 ? out : undefined;
  };
  const normalizeFlags = (v: unknown) => {
    if (!v || typeof v !== "object") return undefined;
    const o = v as Record<string, unknown>;
    const b = (k: string) => o[k] === true;
    return {
      hasReadme: b("hasReadme"),
      hasTests: b("hasTests"),
      hasCI: b("hasCI"),
      hasLicense: b("hasLicense"),
      hasGitignore: b("hasGitignore"),
      typedLang: b("typedLang"),
    };
  };
  let repos = reposRaw
    .map((r) => {
      const base = {
        name: asString(r?.name, "repo").slice(0, 100) || "repo",
        language: asString(r?.language, "Unknown").slice(0, 60) || "Unknown",
        stars: asInt(r?.stars, 0),
        lastCommit:
          typeof r?.lastCommit === "string" && /^\d{4}-\d{2}-\d{2}/.test(r.lastCommit as string)
            ? (r.lastCommit as string).slice(0, 10)
            : new Date().toISOString().slice(0, 10),
        score: clampedScore(r?.score),
        summary: asString(r?.summary, "No summary.").slice(0, 400),
      };
      // v3 optional fields — pass through if present, ignore if not.
      return {
        ...base,
        ...(typeof r?.impact === "number"
          ? { impact: clampedScore(r.impact) }
          : {}),
        ...(typeof r?.quality === "number"
          ? { quality: clampedScore(r.quality) }
          : {}),
        ...(typeof r?.depth === "number"
          ? { depth: clampedScore(r.depth) }
          : {}),
        ...(normalizeEvidence(r?.impactEvidence)
          ? { impactEvidence: normalizeEvidence(r?.impactEvidence) }
          : {}),
        ...(normalizeEvidence(r?.qualityEvidence)
          ? { qualityEvidence: normalizeEvidence(r?.qualityEvidence) }
          : {}),
        ...(normalizeEvidence(r?.depthEvidence)
          ? { depthEvidence: normalizeEvidence(r?.depthEvidence) }
          : {}),
        ...(normalizeFlags(r?.flags)
          ? { flags: normalizeFlags(r?.flags) }
          : {}),
      };
    })
    .slice(0, 12);
  if (repos.length === 0) {
    repos = [
      {
        name: "unknown",
        language: "Unknown",
        stars: 0,
        lastCommit: new Date().toISOString().slice(0, 10),
        score: clampedScore(overallScore),
        summary: `Couldn't extract top repos for ${fallback.login}.`,
      },
    ];
  }

  // ---- roasts: optional but normalise shape ------------------------------
  const roasts = asArray<Record<string, unknown>>(obj.roasts, [])
    .map((r) => {
      const flavor = asString(r?.flavor, "yellow").toLowerCase();
      const safeFlavor = ["red", "blue", "green", "yellow", "purple"].includes(flavor)
        ? (flavor as "red" | "blue" | "green" | "yellow" | "purple")
        : "yellow";
      return {
        label: asString(r?.label, "Uncategorised").slice(0, 80),
        body: asString(r?.body, "").slice(0, 400),
        flavor: safeFlavor,
      };
    })
    .filter((r) => r.body.length >= 5)
    .slice(0, 6);

  // ---- timeline: skip entries with bad dates -----------------------------
  const timeline = asArray<Record<string, unknown>>(obj.timeline, [])
    .filter((e) => typeof e?.date === "string" && /^\d{4}-\d{2}-\d{2}/.test(e.date as string))
    .map((e) => ({
      date: (e.date as string).slice(0, 10),
      label: asString(e?.label, "Milestone").slice(0, 240),
      ...(typeof e?.repo === "string" ? { repo: (e.repo as string).slice(0, 100) } : {}),
    }))
    .slice(0, 8);

  // ---- totals: shape + clamp --------------------------------------------
  const totalsRaw = (obj.totals ?? {}) as Record<string, unknown>;
  const totals = {
    repos: asInt(totalsRaw.repos, 0),
    commits: asInt(totalsRaw.commits, 0),
    followers: asInt(totalsRaw.followers, 0),
  };

  // ---- categoryReasoning: accept partial/missing gracefully -------------
  const rawReasoning = (obj.categoryReasoning ?? {}) as Record<string, unknown>;
  const categoryReasoning = Object.fromEntries(
    CATEGORIES.map((c) => {
      const bullets = Array.isArray(rawReasoning[c.key])
        ? (rawReasoning[c.key] as unknown[])
            .filter((v) => typeof v === "string" && v.length >= 5)
            .map((v) => (v as string).slice(0, 320))
            .slice(0, 6)
        : [];
      return [c.key, bullets];
    }),
  );

  // ---- tier: trust server's mapping -------------------------------------
  const tier = tierForScore(overallScore).tier;

  return {
    rubricVersion: RUBRIC_VERSION,
    overallScore,
    tier,
    categoryScores,
    categoryReasoning,
    languages: finalLanguages,
    heatmap,
    repos,
    roasts,
    timeline,
    totals,
  };
}

function normalizeGrid(input: unknown[][], fallback: number[][]): number[][] {
  const out: number[][] = [];
  const source = Array.isArray(input) && input.length > 0 ? input : fallback;
  for (const w of source.slice(-52)) {
    const days: number[] = [];
    const row = Array.isArray(w) ? (w as unknown[]) : [];
    for (const v of row.slice(0, 7)) {
      const n = typeof v === "number" ? v : Number(v);
      days.push(Number.isFinite(n) ? Math.max(0, Math.min(4, Math.floor(n))) : 0);
    }
    while (days.length < 7) days.push(0);
    out.push(days);
  }
  while (out.length < 52) out.unshift([0, 0, 0, 0, 0, 0, 0]);
  return out;
}
