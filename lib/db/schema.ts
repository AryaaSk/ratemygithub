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

export const referrals = pgTable(
  "referrals",
  {
    /** Public, URL-safe referral identifier used as ?ref=<id>. */
    id: text("id").primaryKey(),
    sourceType: text("source_type")
      .$type<"manual" | "x_share">()
      .notNull()
      .default("manual"),
    /** Populated for referrals created by the built-in Share on X button. */
    sourceRatingId: uuid("source_rating_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("referrals_source_rating_idx").on(t.sourceRatingId)],
);

export const referralVisits = pgTable(
  "referral_visits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referralId: text("referral_id")
      .notNull()
      .references(() => referrals.id, { onDelete: "cascade" }),
    landingPath: text("landing_path").notNull().default("/"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("referral_visits_referral_created_idx").on(
      t.referralId,
      t.createdAt,
    ),
  ],
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
    /** Last-touch referral visit active when this rating was submitted. */
    referralVisitId: uuid("referral_visit_id").references(
      () => referralVisits.id,
      { onDelete: "set null" },
    ),
    rubricVersion: integer("rubric_version").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("ratings_login_created_idx").on(t.login, t.createdAt),
    index("ratings_score_idx").on(t.score),
    index("ratings_referral_visit_idx").on(t.referralVisitId),
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
export type ReferralRow = typeof referrals.$inferSelect;
export type ReferralVisitRow = typeof referralVisits.$inferSelect;
export type RatingRow = typeof ratings.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
