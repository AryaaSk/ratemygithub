import "server-only";
import { db, schema } from "./client";
import { desc, eq, sql, and, gte } from "drizzle-orm";

/**
 * Top N unique users by their latest rating score.
 *
 * `ratings` is append-only — re-rating a user inserts a new row. To stop the
 * leaderboard from shrinking as duplicates fill the top slots, collapse to
 * one row per login (keeping the most recent rating) before sorting.
 */
export async function getTopRatings(limit = 100) {
  const latest = db()
    .selectDistinctOn([schema.ratings.login], {
      login: schema.ratings.login,
      score: schema.ratings.score,
      tier: schema.ratings.tier,
      createdAt: schema.ratings.createdAt,
    })
    .from(schema.ratings)
    .orderBy(schema.ratings.login, desc(schema.ratings.createdAt))
    .as("latest");

  return db()
    .select({
      login: schema.users.displayLogin,
      avatarUrl: schema.users.avatarUrl,
      score: latest.score,
      tier: latest.tier,
      ratedAt: latest.createdAt,
    })
    .from(latest)
    .innerJoin(schema.users, eq(latest.login, schema.users.login))
    // Deterministic tiebreakers — without these, tied scores swap positions
    // across cache renewals and users appear to "go missing."
    .orderBy(desc(latest.score), desc(latest.createdAt), latest.login)
    .limit(limit);
}

/** Most recent ratings. */
export async function getRecentRatings(limit = 20) {
  return db()
    .select({
      login: schema.users.displayLogin,
      avatarUrl: schema.users.avatarUrl,
      score: schema.ratings.score,
      tier: schema.ratings.tier,
      ratedAt: schema.ratings.createdAt,
    })
    .from(schema.ratings)
    .innerJoin(schema.users, eq(schema.ratings.login, schema.users.login))
    .orderBy(desc(schema.ratings.createdAt))
    .limit(limit);
}

// -----------------------------------------------------------------------------
// "Daily vibes" homepage panel queries.
// -----------------------------------------------------------------------------

export type RoastSample = {
  login: string;
  displayLogin: string;
  avatarUrl: string | null;
  score: number;
  tier: string;
  label: string;
  body: string;
  flavor: string;
};

/**
 * Random sample of roasts from latest ratings within the last `hours` hours.
 * Pulls roasts from each user's *latest* rating only, so an old roast on a
 * stale score doesn't leak through.
 */
export async function getRecentRoastSamples(hours: number, limit: number) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await db().execute<{
    login: string;
    display_login: string;
    avatar_url: string | null;
    score: number;
    tier: string;
    label: string;
    body: string;
    flavor: string;
  }>(
    sql`with latest as (
          select distinct on (login) login, score, tier, roasts, created_at
          from ${schema.ratings}
          where created_at >= ${since}::timestamptz
          order by login, created_at desc
        )
        select
          l.login as login,
          u.display_login as display_login,
          u.avatar_url as avatar_url,
          l.score as score,
          l.tier as tier,
          (r->>'label') as label,
          (r->>'body') as body,
          (r->>'flavor') as flavor
        from latest l
        inner join ${schema.users} u on l.login = u.login,
        jsonb_array_elements(l.roasts) as r
        order by random()
        limit ${limit}`,
  );
  return rows.map((r) => ({
    login: r.login,
    displayLogin: r.display_login,
    avatarUrl: r.avatar_url,
    score: r.score,
    tier: r.tier,
    label: r.label,
    body: r.body,
    flavor: r.flavor,
  })) satisfies RoastSample[];
}

export type DailyStats = {
  hours: number;
  nRatings: number;
  nUsers: number;
  medianScore: number;
  avgScore: number;
  sCount: number;
  fCount: number;
};

export async function getDailyStats(hours: number): Promise<DailyStats> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await db().execute<{
    n_ratings: number;
    n_users: number;
    median_score: number | null;
    avg_score: number | null;
    s_count: number;
    f_count: number;
  }>(
    sql`with latest as (
          select distinct on (login) login, score, tier
          from ${schema.ratings}
          where created_at >= ${since}::timestamptz
          order by login, created_at desc
        )
        select
          (select count(*) from ${schema.ratings} where created_at >= ${since}::timestamptz)::int as n_ratings,
          count(*)::int as n_users,
          round(percentile_cont(0.5) within group (order by score)::numeric, 1)::float as median_score,
          round(avg(score)::numeric, 1)::float as avg_score,
          coalesce(sum((tier = 'S')::int), 0)::int as s_count,
          coalesce(sum((tier = 'F')::int), 0)::int as f_count
        from latest`,
  );
  const r = rows[0];
  return {
    hours,
    nRatings: r?.n_ratings ?? 0,
    nUsers: r?.n_users ?? 0,
    medianScore: r?.median_score ?? 0,
    avgScore: r?.avg_score ?? 0,
    sCount: r?.s_count ?? 0,
    fCount: r?.f_count ?? 0,
  };
}

export type Climber = {
  login: string;
  displayLogin: string;
  avatarUrl: string | null;
  oldScore: number;
  newScore: number;
  delta: number;
};

/**
 * Users who re-rated within the last `hours` hours and whose new score is at
 * least `minDelta` points above the previous rating. Sorted by delta desc.
 */
export async function getTopClimbers(
  hours: number,
  limit: number,
  minDelta = 5,
) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
  const rows = await db().execute<{
    login: string;
    display_login: string;
    avatar_url: string | null;
    old_score: number;
    new_score: number;
    delta: number;
  }>(
    sql`with ranked as (
          select login, score, created_at,
            row_number() over (partition by login order by created_at desc) as rn
          from ${schema.ratings}
        )
        select
          curr.login as login,
          u.display_login as display_login,
          u.avatar_url as avatar_url,
          prev.score as old_score,
          curr.score as new_score,
          round((curr.score - prev.score)::numeric, 1)::float as delta
        from ranked curr
        inner join ranked prev on prev.login = curr.login and prev.rn = 2
        inner join ${schema.users} u on curr.login = u.login
        where curr.rn = 1
          and curr.created_at >= ${since}::timestamptz
          and (curr.score - prev.score) >= ${minDelta}
        order by (curr.score - prev.score) desc
        limit ${limit}`,
  );
  return rows.map((r) => ({
    login: r.login,
    displayLogin: r.display_login,
    avatarUrl: r.avatar_url,
    oldScore: r.old_score,
    newScore: r.new_score,
    delta: r.delta,
  })) satisfies Climber[];
}

/** Latest rating for a specific user. */
export async function getLatestRating(login: string) {
  const rows = await db()
    .select()
    .from(schema.ratings)
    .where(eq(schema.ratings.login, login.toLowerCase()))
    .orderBy(desc(schema.ratings.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

/** Percentile for a score, computed live across all ratings. */
export async function getPercentileForScore(score: number) {
  const rows = await db().execute<{ total: number; below: number }>(
    sql`select
          count(*)::int as total,
          sum(case when ${schema.ratings.score} <= ${score} then 1 else 0 end)::int as below
        from ${schema.ratings}`,
  );
  const first = rows[0];
  if (!first || first.total === 0) return null;
  return (first.below / first.total) * 100;
}

/**
 * Count of jobs from a given IP in the last `hours` hours.
 * Used as a DB-backed rate-limit backstop — Upstash may be unconfigured or
 * down, so this guarantees one IP can never blow past a hard cap.
 */
export async function getRecentJobCountByIp(ip: string, hours = 1) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.jobs)
    .where(
      and(eq(schema.jobs.clientIp, ip), gte(schema.jobs.createdAt, since)),
    );
  return rows[0]?.n ?? 0;
}

/** Whether a login has an in-flight or completed rating in the last 24h. */
export async function hasRecentRating(login: string, hours = 24) {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);
  const rows = await db()
    .select({ id: schema.ratings.id })
    .from(schema.ratings)
    .where(
      and(
        eq(schema.ratings.login, login.toLowerCase()),
        gte(schema.ratings.createdAt, since),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/** Upsert user record. */
export async function upsertUser(input: {
  login: string;
  displayLogin: string;
  avatarUrl: string | null;
  name: string | null;
  bio: string | null;
  email: string | null;
  githubJoinedAt: string | null;
}) {
  const key = input.login.toLowerCase();
  const joined = input.githubJoinedAt ? new Date(input.githubJoinedAt) : null;
  await db()
    .insert(schema.users)
    .values({
      login: key,
      displayLogin: input.displayLogin,
      avatarUrl: input.avatarUrl,
      name: input.name,
      bio: input.bio,
      email: input.email,
      githubJoinedAt: joined,
    })
    .onConflictDoUpdate({
      target: schema.users.login,
      set: {
        displayLogin: input.displayLogin,
        avatarUrl: input.avatarUrl,
        name: input.name,
        bio: input.bio,
        // Only overwrite email if a new one was provided.
        ...(input.email ? { email: input.email } : {}),
        // Always update GitHub join date if we have one.
        ...(joined ? { githubJoinedAt: joined } : {}),
      },
    });
}

export async function createJob(login: string, clientIp: string | null) {
  const [row] = await db()
    .insert(schema.jobs)
    .values({ login: login.toLowerCase(), clientIp })
    .returning({ id: schema.jobs.id });
  return row.id;
}

export async function getJob(id: string) {
  const rows = await db()
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function markJobRunning(id: string) {
  await db()
    .update(schema.jobs)
    .set({ status: "running", startedAt: new Date() })
    .where(eq(schema.jobs.id, id));
}

export async function markJobDone(id: string, ratingId: string) {
  await db()
    .update(schema.jobs)
    .set({ status: "done", finishedAt: new Date(), ratingId })
    .where(eq(schema.jobs.id, id));
}

export async function markJobFailed(id: string, error: string) {
  await db()
    .update(schema.jobs)
    .set({ status: "failed", finishedAt: new Date(), error })
    .where(eq(schema.jobs.id, id));
}
