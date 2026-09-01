import "server-only";

import {
  Agent,
  OpenAIProvider,
  Runner,
  retryPolicies,
  tool,
  type Model,
  type Usage,
} from "@openai/agents";
import { z } from "zod";
import { PASS_1_SYSTEM, PASS_2_SYSTEM, buildPass3System } from "./system-prompt";
import { normalizeRatingOutput } from "@/lib/scoring/normalize";
import { RatingOutputSchema, type RatingOutput } from "@/lib/scoring/schema";

export const OPENAI_MODELS = {
  pass1: "gpt-5.6-terra",
  pass2: "gpt-5.6-luna",
  pass3: "gpt-5.6-terra",
} as const;

const OPENAI_PASS_2_CALIBRATION = `

=== OPENAI PROVIDER CALIBRATION ===
Apply these rules in addition to the rubric above:
- A repo with fewer than 25 stars and no explicit evidence of external users,
  a deployed product/domain, or third-party adoption MUST NOT exceed 30 Impact.
- Non-trivial code quality does not itself prove Impact. A typed personal repo,
  portfolio, coursework project, or working demo with little adoption is
  normally 20–30 Impact even when its Quality or Depth is much higher.
- The 40-point active-portfolio anchor requires explicit account-wide evidence
  that the owner ships at least three named, non-scratch products. This
  per-repo input does not establish that fact by itself; do not assume it.
`.trim();

const OPENAI_PASS_3_CALIBRATION = `

=== OPENAI PROVIDER CALIBRATION ===
Apply these hard calibration rules after the rubric above:
- When totalStars < 25 AND followers < 10, Breadth MUST NOT exceed 55 unless
  the per-repo evidence clearly proves multiple independent production domains.
  HTML, CSS, shell/config files, and JS/TS variants are not separate domains.
- Under that same low-signal condition, Community MUST NOT exceed 40 based on
  totalPRsYear alone. That count does not prove the PRs were external or adopted.
- Preserve high-end scores: these low-signal caps do not apply when adoption,
  followers, or clearly external community evidence is present.
`.trim();

const FILE_SELECTION_SCHEMA = z
  .object({
    selections: z
      .array(
        z
          .object({
            repo: z.string().min(1).max(100),
            files: z.array(z.string().min(1).max(500)).max(20),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();

const EVIDENCE_SCHEMA = z.array(z.string().min(5).max(280)).min(2).max(4);

export const REPO_SCORE_SCHEMA = z
  .object({
    impact: z.number().int().min(0).max(100),
    quality: z.number().int().min(0).max(100),
    depth: z.number().int().min(0).max(100),
    overallRepoScore: z.number().int().min(0).max(100),
    summary: z.string().min(5).max(320),
    impactEvidence: EVIDENCE_SCHEMA,
    qualityEvidence: EVIDENCE_SCHEMA,
    depthEvidence: EVIDENCE_SCHEMA,
  })
  .strict();

const CATEGORY_SCORES_SCHEMA = z
  .object({
    consistency: z.number().min(0).max(100),
    impact: z.number().min(0).max(100),
    quality: z.number().min(0).max(100),
    breadth: z.number().min(0).max(100),
    depth: z.number().min(0).max(100),
    community: z.number().min(0).max(100),
  })
  .strict();

const CATEGORY_REASONING_SCHEMA = z
  .object({
    consistency: z.array(z.string().min(5).max(320)).min(2).max(5),
    impact: z.array(z.string().min(5).max(320)).min(2).max(5),
    quality: z.array(z.string().min(5).max(320)).min(2).max(5),
    breadth: z.array(z.string().min(5).max(320)).min(2).max(5),
    depth: z.array(z.string().min(5).max(320)).min(2).max(5),
    community: z.array(z.string().min(5).max(320)).min(2).max(5),
  })
  .strict();

export const PROFILE_RATING_SCHEMA = z
  .object({
    rubricVersion: z.literal(2),
    overallScore: z.number().min(0).max(100),
    tier: z.enum(["S", "A", "B", "C", "D", "F"]),
    categoryScores: CATEGORY_SCORES_SCHEMA,
    categoryReasoning: CATEGORY_REASONING_SCHEMA,
    languages: z
      .array(
        z
          .object({
            language: z.string().min(1).max(40),
            pct: z.number().min(0).max(100),
          })
          .strict(),
      )
      .max(10),
    heatmap: z
      .array(z.array(z.number().int().min(0).max(4)).length(7))
      .length(52),
    repos: z
      .array(
        z
          .object({
            name: z.string().min(1).max(100),
            language: z.string().min(1).max(40),
            stars: z.number().int().min(0),
            lastCommit: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
            score: z.number().min(0).max(100),
            summary: z.string().min(5).max(320),
          })
          .strict(),
      )
      .min(1)
      .max(12),
    roasts: z
      .array(
        z
          .object({
            label: z.string().min(1).max(60),
            body: z.string().min(5).max(320),
            flavor: z.enum(["red", "blue", "green", "yellow", "purple"]),
          })
          .strict(),
      )
      .max(6),
    timeline: z
      .array(
        z
          .object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
            label: z.string().min(3).max(200),
            repo: z.string().max(100).nullable(),
          })
          .strict(),
      )
      .max(16),
    totals: z
      .object({
        repos: z.number().int().min(0),
        commits: z.number().int().min(0),
        followers: z.number().int().min(0),
      })
      .strict(),
  })
  .strict();

export type OpenAIRepoScore = z.infer<typeof REPO_SCORE_SCHEMA>;

type NormalizationFallback = {
  heatmap: number[][];
  langPcts: Array<{ language: string; pct: number }>;
  login: string;
};

type OpenAIModelSet = {
  pass1: string | Model;
  pass2: string | Model;
  pass3: string | Model;
};

export type UsageBucket = {
  input: number;
  output: number;
  cachedInput: number;
  cacheWrite: number;
  calls: number;
};

export type OpenAIUsageSummary = {
  totalInput: number;
  totalOutput: number;
  totalCost: number;
  perModel: Array<{ model: string; bucket: UsageBucket; cost: number }>;
};

const PRICING_PER_MTOK: Record<
  string,
  { input: number; cachedInput: number; output: number }
> = {
  "gpt-5.6-terra": { input: 2, cachedInput: 0.2, output: 12 },
  "gpt-5.6-luna": { input: 0.2, cachedInput: 0.02, output: 1.2 },
};

export function estimateOpenAICost(model: string, bucket: UsageBucket): number {
  const price = PRICING_PER_MTOK[model] ?? PRICING_PER_MTOK[OPENAI_MODELS.pass1];
  const uncachedInput = Math.max(
    0,
    bucket.input - bucket.cachedInput - bucket.cacheWrite,
  );
  // Current GPT-5.6 pricing applies a 2x input and 1.5x output multiplier
  // when a single request exceeds 272k input tokens. Our configured prompt
  // caps normally stay below this; average-per-call is a conservative guard
  // when only aggregate SDK usage is available here.
  const longContext = bucket.calls > 0 && bucket.input / bucket.calls > 272_000;
  const inputMultiplier = longContext ? 2 : 1;
  const outputMultiplier = longContext ? 1.5 : 1;
  return (
    (uncachedInput / 1_000_000) * price.input * inputMultiplier +
    (bucket.cachedInput / 1_000_000) * price.cachedInput * inputMultiplier +
    (bucket.cacheWrite / 1_000_000) * price.input * 1.25 * inputMultiplier +
    (bucket.output / 1_000_000) * price.output * outputMultiplier
  );
}

const TRANSIENT_RETRY = {
  maxRetries: 1,
  backoff: { initialDelayMs: 500, maxDelayMs: 2_000, multiplier: 2, jitter: true },
  policy: retryPolicies.any(
    retryPolicies.providerSuggested(),
    retryPolicies.retryAfter(),
    retryPolicies.networkError(),
    retryPolicies.httpStatus([408, 409, 429, 500, 502, 503, 504]),
  ),
};

function modelLabel(model: string | Model, fallback: string): string {
  return typeof model === "string" ? model : fallback;
}

function detailTotal(details: Array<Record<string, number>>, keys: string[]): number {
  let total = 0;
  for (const detail of details) {
    for (const key of keys) total += detail[key] ?? 0;
  }
  return total;
}

function parseToolOutput(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

export class OpenAIRankingProvider {
  readonly repoConcurrency = 4;
  readonly modelNames: { pass1: string; pass2: string; pass3: string };

  private readonly runner: Runner;
  private readonly models: OpenAIModelSet;
  private readonly usageByModel = new Map<string, UsageBucket>();

  constructor(options: {
    apiKey?: string;
    models?: Partial<OpenAIModelSet>;
    tracingDisabled?: boolean;
  } = {}) {
    this.models = { ...OPENAI_MODELS, ...options.models };
    this.modelNames = {
      pass1: modelLabel(this.models.pass1, OPENAI_MODELS.pass1),
      pass2: modelLabel(this.models.pass2, OPENAI_MODELS.pass2),
      pass3: modelLabel(this.models.pass3, OPENAI_MODELS.pass3),
    };

    const modelProvider = options.apiKey
      ? new OpenAIProvider({ apiKey: options.apiKey, useResponses: true })
      : undefined;
    this.runner = new Runner({
      ...(modelProvider ? { modelProvider } : {}),
      tracingDisabled: options.tracingDisabled ?? false,
      traceIncludeSensitiveData: false,
      workflowName: "ratemygithub-openai-ranking",
    });
  }

  async selectFiles(userMessage: string) {
    const agent = new Agent({
      name: "RateMyGitHub file selector",
      instructions: PASS_1_SYSTEM,
      model: this.models.pass1,
      outputType: FILE_SELECTION_SCHEMA,
      modelSettings: {
        reasoning: { effort: "low" },
        text: { verbosity: "low" },
        maxTokens: 2_048,
        timeoutMs: 90_000,
        store: false,
        retry: TRANSIENT_RETRY,
      },
    });
    const result = await this.runner.run(agent, userMessage, { maxTurns: 1 });
    this.record(this.modelNames.pass1, result.state.usage);
    if (!result.finalOutput) throw new Error("OpenAI Pass 1 returned no final output.");
    return FILE_SELECTION_SCHEMA.parse(result.finalOutput);
  }

  async scoreRepo(userMessage: string): Promise<OpenAIRepoScore> {
    const submitRepoScore = tool({
      name: "submit_repo_score",
      description:
        "Submit the final score for one GitHub repository. All fields are required.",
      parameters: REPO_SCORE_SCHEMA,
      execute: async (input) => input,
    });
    const agent = new Agent({
      name: "RateMyGitHub repository grader",
      instructions: `${PASS_2_SYSTEM}\n\n${OPENAI_PASS_2_CALIBRATION}`,
      model: this.models.pass2,
      tools: [submitRepoScore],
      toolUseBehavior: "stop_on_first_tool",
      modelSettings: {
        toolChoice: "submit_repo_score",
        reasoning: { effort: "medium" },
        text: { verbosity: "low" },
        maxTokens: 2_048,
        timeoutMs: 90_000,
        store: false,
        retry: TRANSIENT_RETRY,
      },
    });
    const result = await this.runner.run(agent, userMessage, { maxTurns: 1 });
    this.record(this.modelNames.pass2, result.state.usage);
    return REPO_SCORE_SCHEMA.parse(parseToolOutput(result.finalOutput));
  }

  async aggregateProfile(
    userMessage: string,
    fallback: NormalizationFallback,
  ): Promise<RatingOutput> {
    const submitRating = tool({
      name: "submit_rating",
      description: "Submit the final RateMyGitHub profile rating. All fields are required.",
      parameters: PROFILE_RATING_SCHEMA,
      execute: async (input) => input,
    });
    const agent = new Agent({
      name: "RateMyGitHub profile aggregator",
      instructions: `${buildPass3System()}\n\n${OPENAI_PASS_3_CALIBRATION}`,
      model: this.models.pass3,
      tools: [submitRating],
      toolUseBehavior: "stop_on_first_tool",
      modelSettings: {
        toolChoice: "submit_rating",
        reasoning: { effort: "medium" },
        text: { verbosity: "low" },
        maxTokens: 8_192,
        timeoutMs: 90_000,
        store: false,
        retry: TRANSIENT_RETRY,
      },
    });
    const result = await this.runner.run(agent, userMessage, { maxTurns: 1 });
    this.record(this.modelNames.pass3, result.state.usage);
    const raw = parseToolOutput(result.finalOutput);
    const normalized = normalizeRatingOutput(raw, fallback);
    const parsed = RatingOutputSchema.safeParse(normalized);
    if (!parsed.success) {
      throw new Error(
        `OpenAI Pass 3 output failed schema validation: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
          .join("; ")}`,
      );
    }
    return parsed.data;
  }

  usageSummary(): OpenAIUsageSummary {
    let totalInput = 0;
    let totalOutput = 0;
    let totalCost = 0;
    const perModel: OpenAIUsageSummary["perModel"] = [];
    for (const [model, bucket] of this.usageByModel) {
      const cost = estimateOpenAICost(model, bucket);
      totalInput += bucket.input;
      totalOutput += bucket.output;
      totalCost += cost;
      perModel.push({ model, bucket: { ...bucket }, cost });
    }
    return { totalInput, totalOutput, totalCost, perModel };
  }

  private record(model: string, usage: Usage) {
    const bucket = this.usageByModel.get(model) ?? {
      input: 0,
      output: 0,
      cachedInput: 0,
      cacheWrite: 0,
      calls: 0,
    };
    bucket.input += usage.inputTokens;
    bucket.output += usage.outputTokens;
    bucket.cachedInput += detailTotal(usage.inputTokensDetails, [
      "cached_tokens",
      "cache_read_tokens",
    ]);
    bucket.cacheWrite += detailTotal(usage.inputTokensDetails, [
      "cache_write_tokens",
    ]);
    bucket.calls += usage.requests;
    this.usageByModel.set(model, bucket);
  }
}
