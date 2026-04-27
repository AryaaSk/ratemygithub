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
