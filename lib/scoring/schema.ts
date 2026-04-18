import { z } from "zod";
import { RUBRIC_VERSION } from "./rubric";

const categoryScore = z.number().min(0).max(100);

/**
 * Graceful string bounding. We want the DB to stay tidy but we don't want
 * the whole rating to be rejected because the model wrote 321 chars when we
 * wanted ≤320. So: we enforce a minimum (a blank is still a bug) and
 * TRUNCATE with an ellipsis if it overshoots the max.
 *
 * The tool's input_schema in run.ts still advertises a maxLength — that
 * steers the model toward brevity — but it's a hint, not a gate.
 */
function bounded(min: number, max: number) {
  return z
    .string()
    .min(min)
    .transform((s) =>
      s.length > max ? s.slice(0, Math.max(0, max - 1)) + "…" : s,
    );
}

export const RatingOutputSchema = z.object({
  rubricVersion: z.literal(RUBRIC_VERSION),
  overallScore: z.number().min(0).max(100),
  tier: z.enum(["S", "A", "B", "C", "D", "F"]),
  categoryScores: z.object({
    consistency: categoryScore,
    impact: categoryScore,
    quality: categoryScore,
    breadth: categoryScore,
    depth: categoryScore,
    community: categoryScore,
  }),
  languages: z
    .array(
      z.object({
        language: bounded(1, 60),
        pct: z.number().min(0).max(100),
      }),
    )
    .max(10),
  heatmap: z
    .array(z.array(z.number().int().min(0).max(4)).length(7))
    .length(52),
  repos: z
    .array(
      z.object({
        name: bounded(1, 100),
        language: bounded(1, 60),
        stars: z.number().int().min(0),
        lastCommit: z.string().regex(/^\d{4}-\d{2}-\d{2}/, "ISO-ish date"),
        score: z.number().min(0).max(100),
        summary: bounded(5, 400),
        // v3: per-repo rubric scores (optional for backwards compat with v2 rows).
        impact: z.number().min(0).max(100).optional(),
        quality: z.number().min(0).max(100).optional(),
        depth: z.number().min(0).max(100).optional(),
        // v3: evidence bullets per repo per category (optional).
        impactEvidence: z.array(bounded(5, 280)).max(5).optional(),
        qualityEvidence: z.array(bounded(5, 280)).max(5).optional(),
        depthEvidence: z.array(bounded(5, 280)).max(5).optional(),
        // v3: authoritative presence flags from server tree inspection.
        flags: z
          .object({
            hasReadme: z.boolean(),
            hasTests: z.boolean(),
            hasCI: z.boolean(),
            hasLicense: z.boolean(),
            hasGitignore: z.boolean(),
            typedLang: z.boolean(),
          })
          .optional(),
      }),
    )
    .min(1)
    .max(12),
  roasts: z
    .array(
      z.object({
        label: bounded(1, 80),
        body: bounded(5, 400),
        flavor: z.enum(["red", "blue", "green", "yellow", "purple"]),
      }),
    )
    .max(6),
  timeline: z
    .array(
      z.object({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
        label: bounded(3, 240),
        repo: bounded(0, 100).optional(),
      }),
    )
    .max(16),
  totals: z.object({
    repos: z.number().int().min(0),
    commits: z.number().int().min(0),
    followers: z.number().int().min(0),
  }),
  /**
   * 2–5 concrete evidence bullets per category. Shown inline in the rubric
   * footer so a rater can see exactly why each sub-score landed where it did.
   * Each bullet should reference specific numbers from THIS profile's data.
   */
  categoryReasoning: z
    .object({
      consistency: z.array(bounded(5, 320)).max(6).default([]),
      impact: z.array(bounded(5, 320)).max(6).default([]),
      quality: z.array(bounded(5, 320)).max(6).default([]),
      breadth: z.array(bounded(5, 320)).max(6).default([]),
      depth: z.array(bounded(5, 320)).max(6).default([]),
      community: z.array(bounded(5, 320)).max(6).default([]),
    })
    .default({
      consistency: [],
      impact: [],
      quality: [],
      breadth: [],
      depth: [],
      community: [],
    }),
});

export type RatingOutput = z.infer<typeof RatingOutputSchema>;
