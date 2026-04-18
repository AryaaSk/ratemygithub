import {
  pgTable,
  text,
  timestamp,
  integer,
  doublePrecision,
  jsonb,
  uuid,
  pgEnum,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const jobStatusEnum = pgEnum("job_status", [
  "queued",
  "running",
  "done",
  "failed",
]);

export const users = pgTable(
  "users",
  {
    login: text("login").primaryKey(), // lowercase github login
    displayLogin: text("display_login").notNull(),
    avatarUrl: text("avatar_url"),
    name: text("name"),
    bio: text("bio"),
    email: text("email"),
    /** When the user actually joined GitHub (from the GitHub API). */
    githubJoinedAt: timestamp("github_joined_at", { withTimezone: true }),
    /** When we first inserted this row — NOT the GitHub join date. */
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("users_login_idx").on(t.login)],
);

export const ratings = pgTable(
  "ratings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    login: text("login")
      .notNull()
      .references(() => users.login, { onDelete: "cascade" }),
    score: doublePrecision("score").notNull(),
    tier: text("tier").notNull(),
    categoryScores: jsonb("category_scores").$type<Record<string, number>>().notNull(),
    languages: jsonb("languages").$type<Array<{ language: string; pct: number }>>().notNull(),
    heatmap: jsonb("heatmap").$type<number[][]>().notNull(),
    repos: jsonb("repos").$type<Array<{
      name: string;
      language: string;
      stars: number;
      lastCommit: string;
      score: number;
      summary: string;
    }>>().notNull(),
    roasts: jsonb("roasts").$type<Array<{ label: string; body: string; flavor: string }>>().notNull(),
    timeline: jsonb("timeline").$type<Array<{ date: string; label: string; repo?: string }>>().notNull(),
    totals: jsonb("totals").$type<{ repos: number; commits: number; followers: number }>().notNull(),
    /** Per-category evidence bullets — populated by Pass 2 of the scorer. */
    categoryReasoning: jsonb("category_reasoning")
      .$type<Record<string, string[]>>()
      .notNull()
      .default({}),
    /** 365 if heatmap came from GraphQL contributionCalendar, 90 when we fell back to public events. */
    heatmapWindowDays: integer("heatmap_window_days").notNull().default(365),
    rubricVersion: integer("rubric_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ratings_login_created_idx").on(t.login, t.createdAt),
    index("ratings_score_idx").on(t.score),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    login: text("login").notNull(),
    status: jobStatusEnum("status").notNull().default("queued"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    ratingId: uuid("rating_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clientIp: text("client_ip"),
  },
  (t) => [
    index("jobs_login_status_idx").on(t.login, t.status),
    index("jobs_created_idx").on(t.createdAt),
  ],
);

export type UserRow = typeof users.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
