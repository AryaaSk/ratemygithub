import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { validateGithubLogin } from "@/lib/github/validate";
import {
  hasRecentRating,
  upsertUser,
  createJob,
  markJobDone,
  markJobFailed,
  markJobRunning,
} from "@/lib/db/queries";
import { checkIpLimit, checkLoginLimit } from "@/lib/ratelimit";
import { verifyTurnstile } from "@/lib/turnstile";
import { runAgent } from "@/lib/agent/run";
import { db, schema } from "@/lib/db/client";

export const runtime = "nodejs";
// 300s is the Vercel Pro ceiling. Our p50 is ~75s and p95 is ~105s, so we
// need headroom beyond 60s or every slow profile 504s before finishing.
export const maxDuration = 300;

const BodySchema = z.object({
  login: z.string().min(1).max(39),
  email: z
    .string()
    .email()
    .optional()
    .or(z.literal("").transform(() => undefined)),
  turnstileToken: z.string().optional(),
});

function clientIp(req: NextRequest) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

/**
 * Friendly user-facing error. The raw server message stays in the logs.
 * `code` is something the frontend can key off of; `userMessage` is plain English.
 */
function friendlyError(raw: string): { code: string; userMessage: string } {
  const m = raw.toLowerCase();
  if (m.includes("rate limit") || m.includes("403") || m.includes("429")) {
    return {
      code: "github_rate_limited",
      userMessage:
        "GitHub throttled our API calls. Give it a minute and try again.",
    };
  }
  if (m.includes("schema") || m.includes("validation")) {
    return {
      code: "grader_shape",
      userMessage:
        "The grader returned an unusual response. Retry — this almost always works the second time.",
    };
  }
  if (m.includes("timeout") || m.includes("aborted") || m.includes("504")) {
    return {
      code: "timeout",
      userMessage:
        "Scoring timed out. Anthropic or GitHub may be slow — retry in a minute, it usually works the second time.",
    };
  }
  if (m.includes("anthropic") || m.includes("overloaded")) {
    return {
      code: "anthropic_transient",
      userMessage:
        "Anthropic's API was busy. Retry in a few seconds.",
    };
  }
  if (m.includes("no non-fork repos")) {
    return {
      code: "empty_profile",
      userMessage:
        "This user has no original public repos to score.",
    };
  }
  return {
    code: "scoring_failed",
    userMessage:
      "Something went wrong scoring this profile. Retry — if it keeps failing, tell us the username.",
  };
}

export async function POST(req: NextRequest) {
  const reqStart = Date.now();
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  console.log(
    `[rmg] POST /api/rate body=${JSON.stringify(json).slice(0, 120)}`,
  );

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid body.", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const ip = clientIp(req);

  // Bot check (soft-disabled without Turnstile env).
  try {
    const turnstile = await verifyTurnstile(parsed.data.turnstileToken ?? null, ip);
    if (!turnstile.ok) {
      return NextResponse.json(
        { error: "Bot check failed. Refresh and try again.", code: "turnstile" },
        { status: 400 },
      );
    }
  } catch (e) {
    // Never let Turnstile infra problems block a rating.
    console.warn(`[rmg] turnstile check errored; allowing through: ${(e as Error).message}`);
  }

  // Per-IP limit — stop scripted flooding before we spend a GitHub call.
  try {
    const ipLimit = await checkIpLimit(ip);
    if (!ipLimit.ok) {
      return NextResponse.json(
        { error: "Too many submissions from this IP. Try again in an hour." },
        { status: 429 },
      );
    }
  } catch (e) {
    console.warn(`[rmg] ratelimit errored; allowing through: ${(e as Error).message}`);
  }

  // Validate username (regex + live GitHub check + must be a real user).
  let validated;
  try {
    validated = await validateGithubLogin(parsed.data.login);
  } catch (e) {
    console.error(`[rmg] validate threw: ${(e as Error).message}`);
    return NextResponse.json(
      {
        error: "Couldn't reach GitHub to verify that username. Try again.",
        code: "github_unreachable",
      },
      { status: 502 },
    );
  }
  if (!validated.ok) {
    const status =
      validated.code === "not_found" || validated.code === "malformed"
        ? 400
        : validated.code === "not_a_user"
          ? 400
          : validated.code === "rate_limited"
            ? 429
            : 502;
    return NextResponse.json(
      { error: validated.message, code: validated.code },
      { status },
    );
  }

  const { login, loginKey, avatarUrl, name, bio, createdAt } = validated.user;

  // Per-login 24h daily lock (cost-control).
  try {
    const loginLimit = await checkLoginLimit(loginKey);
    if (!loginLimit.ok) {
      return NextResponse.json(
        { error: `${login} was already rated in the last 24h.`, code: "cooldown" },
        { status: 429 },
      );
    }
  } catch (e) {
    console.warn(`[rmg] login-ratelimit errored; falling back to DB check: ${(e as Error).message}`);
  }

  try {
    if (await hasRecentRating(loginKey)) {
      return NextResponse.json(
        { error: `${login} already has a rating in the last 24h.`, code: "cooldown" },
        { status: 429 },
      );
    }
  } catch (e) {
    // A DB error here is really bad — abort rather than proceed blindly.
    console.error(`[rmg] hasRecentRating threw: ${(e as Error).message}`);
    return NextResponse.json(
      { error: "Database unavailable. Try again in a minute.", code: "db_unavailable" },
      { status: 503 },
    );
  }

  // Upsert user so the avatar renders while scoring runs.
  try {
    await upsertUser({
      login: loginKey,
      displayLogin: login,
      avatarUrl,
      name,
      bio,
      email: parsed.data.email ?? null,
      githubJoinedAt: createdAt,
    });
  } catch (e) {
    console.error(`[rmg] upsertUser failed: ${(e as Error).message}`);
    return NextResponse.json(
      { error: "Database unavailable. Try again in a minute.", code: "db_unavailable" },
      { status: 503 },
    );
  }

  // Create a job row purely for observability / job-history.
  let jobId: string;
  try {
    jobId = await createJob(loginKey, ip);
    await markJobRunning(jobId);
  } catch (e) {
    console.error(`[rmg] createJob failed: ${(e as Error).message}`);
    return NextResponse.json(
      { error: "Database unavailable. Try again in a minute.", code: "db_unavailable" },
      { status: 503 },
    );
  }

  try {
    const { rating, heatmapWindowDays } = await runAgent(loginKey);
    const [row] = await db()
      .insert(schema.ratings)
      .values({
        login: loginKey,
        score: rating.overallScore,
        tier: rating.tier,
        categoryScores: rating.categoryScores,
        categoryReasoning: rating.categoryReasoning,
        languages: rating.languages,
        heatmap: rating.heatmap,
        repos: rating.repos,
        roasts: rating.roasts,
        timeline: rating.timeline,
        totals: rating.totals,
        heatmapWindowDays,
        rubricVersion: rating.rubricVersion,
      })
      .returning({ id: schema.ratings.id });
    await markJobDone(jobId, row.id);
    console.log(
      `[rmg] ${login} done · overall=${rating.overallScore} tier=${rating.tier} · ${((Date.now() - reqStart) / 1000).toFixed(1)}s total`,
    );
    return NextResponse.json({
      login,
      ratingId: row.id,
      score: rating.overallScore,
      tier: rating.tier,
      status: "done",
    });
  } catch (err) {
    const raw = (err as Error).message ?? "Unknown failure.";
    console.error(
      `[rmg] ${login} FAILED after ${((Date.now() - reqStart) / 1000).toFixed(1)}s: ${raw}`,
    );
    const friendly = friendlyError(raw);
    // Best-effort: mark the job failed so observability is correct. If the DB
    // is the thing that died, swallow this — we already have a user response.
    try {
      await markJobFailed(jobId, raw);
    } catch (e) {
      console.error(`[rmg] markJobFailed also failed: ${(e as Error).message}`);
    }
    return NextResponse.json(
      { error: friendly.userMessage, code: friendly.code },
      { status: 500 },
    );
  }
}
