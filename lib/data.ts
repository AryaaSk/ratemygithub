import "server-only";
import {
  getTopRatings,
  getRecentRatings,
  getLatestRating,
} from "@/lib/db/queries";
import { db, schema } from "@/lib/db/client";
import { eq, sql } from "drizzle-orm";
import {
  leaderboardRows as mockLeaderboardRows,
  recentRows as mockRecentRows,
  shameRows as mockShameRows,
  MOCK_BY_LOGIN,
  type RatedUser,
} from "@/lib/mock";
import { tierForScore } from "@/lib/scoring/rubric";
import type { Tier } from "@/lib/scoring/rubric";

/**
 * Data gateway. If DATABASE_URL is unset, every reader falls back to the
 * mock fixture so the whole site demos without infra. The moment a real
 * DB is configured, every page starts reading live data.
 */

const HAS_DB = Boolean(process.env.DATABASE_URL);

export type LeaderboardRow = {
  login: string;
  avatarUrl: string | null;
  score: number;
  tier: Tier;
  ratedAt: string;
};

function mockToRow(r: {
  login: string;
  avatar: string;
  score: number;
  tier: Tier;
  ratedAt: string;
}): LeaderboardRow {
  return {
    login: r.login,
    avatarUrl: r.avatar,
    score: r.score,
    tier: r.tier,
    ratedAt: r.ratedAt,
  };
}

export async function topRows(): Promise<LeaderboardRow[]> {
  if (!HAS_DB) return mockLeaderboardRows().map(mockToRow);
  const rows = await getTopRatings(100);
  return rows.map((r) => ({
    login: r.login,
    avatarUrl: r.avatarUrl,
    score: r.score,
    tier: r.tier as Tier,
    ratedAt: r.ratedAt.toISOString(),
  }));
}

export async function recentRowsData(): Promise<LeaderboardRow[]> {
  if (!HAS_DB) return mockRecentRows().map(mockToRow);
  const rows = await getRecentRatings(20);
  return rows.map((r) => ({
    login: r.login,
    avatarUrl: r.avatarUrl,
    score: r.score,
    tier: r.tier as Tier,
    ratedAt: r.ratedAt.toISOString(),
  }));
}

export async function shameRowsData(): Promise<LeaderboardRow[]> {
  if (!HAS_DB) return mockShameRows().map(mockToRow);
  const all = await getTopRatings(500);
  const rows = all.slice(-6).reverse();
  return rows.map((r) => ({
    login: r.login,
    avatarUrl: r.avatarUrl,
    score: r.score,
    tier: r.tier as Tier,
    ratedAt: r.ratedAt.toISOString(),
  }));
}

export type ProfileData = RatedUser & {
  rank: number;
  percentile: number;
  /** 365 for GraphQL-sourced heatmap, 90 for events fallback, undefined for mocks. */
  heatmapWindowDays: number;
};

export async function profileData(loginParam: string): Promise<ProfileData | null> {
  const key = loginParam.toLowerCase();

  if (!HAS_DB) {
    const u = MOCK_BY_LOGIN[key];
    if (!u) return null;
    const all = mockLeaderboardRows();
    const rank = all.findIndex((r) => r.login.toLowerCase() === key) + 1;
    const percentile = ((all.length - rank + 1) / all.length) * 100;
    return { ...u, rank, percentile, heatmapWindowDays: 365 };
  }

  // Real DB path: join user with their latest rating + compute rank.
  const rating = await getLatestRating(key);
  if (!rating) return null;

  const [userRow] = await db()
    .select()
    .from(schema.users)
    .where(eq(schema.users.login, key))
    .limit(1);
  if (!userRow) return null;

  const rankRows = await db().execute<{ rank: number; total: number }>(
    sql`select
          (
            select count(*)
            from ${schema.ratings} r2
            where r2.score >= ${rating.score}
          )::int as rank,
          (select count(*) from ${schema.ratings})::int as total`,
  );
  const { rank, total } = rankRows[0] ?? { rank: 1, total: 1 };
  const percentile = total ? ((total - rank + 1) / total) * 100 : 100;

  const tier = tierForScore(rating.score).tier;

  const profile: ProfileData = {
    login: userRow.displayLogin,
    name: userRow.name ?? userRow.displayLogin,
    avatar: userRow.avatarUrl ?? `https://github.com/${userRow.displayLogin}.png`,
    bio: userRow.bio ?? "",
    // Real GitHub join date, not the DB row's insert time.
    joined: (userRow.githubJoinedAt ?? userRow.createdAt).toISOString(),
    categoryScores: rating.categoryScores as ProfileData["categoryScores"],
    categoryReasoning: (rating.categoryReasoning ?? {}) as ProfileData["categoryReasoning"],
    languages: rating.languages,
    heatmap: rating.heatmap,
    repos: rating.repos,
    roasts: rating.roasts.map((r) => ({
      label: r.label,
      body: r.body,
      flavor: r.flavor as ProfileData["roasts"][number]["flavor"],
    })),
    timeline: rating.timeline,
    totalRepos: rating.totals.repos,
    totalCommits: rating.totals.commits,
    followers: rating.totals.followers,
    ratedAt: rating.createdAt.toISOString(),
    score: rating.score,
    tier,
    rank,
    percentile,
    heatmapWindowDays: rating.heatmapWindowDays ?? 365,
  };
  return profile;
}
