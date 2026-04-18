-- Initial schema for ratemygithub. Matches lib/db/schema.ts.
-- Run this once per Supabase project. If you prefer `drizzle-kit`, delete
-- this file after pnpm dlx drizzle-kit generate gives you its own.

create type "public"."job_status" as enum ('queued', 'running', 'done', 'failed');

create table if not exists "public"."users" (
  "login"         text primary key,
  "display_login" text not null,
  "avatar_url"    text,
  "name"          text,
  "bio"           text,
  "email"         text,
  "created_at"    timestamp with time zone not null default now()
);

create unique index if not exists "users_login_idx" on "public"."users" ("login");

create table if not exists "public"."ratings" (
  "id"               uuid primary key default gen_random_uuid(),
  "login"            text not null references "public"."users"("login") on delete cascade,
  "score"            double precision not null,
  "tier"             text not null,
  "category_scores"  jsonb not null,
  "languages"        jsonb not null,
  "heatmap"          jsonb not null,
  "repos"            jsonb not null,
  "roasts"           jsonb not null,
  "timeline"         jsonb not null,
  "totals"           jsonb not null,
  "rubric_version"   integer not null,
  "created_at"       timestamp with time zone not null default now()
);

create index if not exists "ratings_login_created_idx" on "public"."ratings" ("login", "created_at");
create index if not exists "ratings_score_idx" on "public"."ratings" ("score");

create table if not exists "public"."jobs" (
  "id"           uuid primary key default gen_random_uuid(),
  "login"        text not null,
  "status"       "public"."job_status" not null default 'queued',
  "error"        text,
  "started_at"   timestamp with time zone,
  "finished_at"  timestamp with time zone,
  "rating_id"    uuid,
  "created_at"   timestamp with time zone not null default now(),
  "client_ip"    text
);

create index if not exists "jobs_login_status_idx" on "public"."jobs" ("login", "status");
create index if not exists "jobs_created_idx" on "public"."jobs" ("created_at");

-- Turn on realtime so the leaderboard + job status stream to the client.
alter publication supabase_realtime add table public.ratings;
alter publication supabase_realtime add table public.jobs;
