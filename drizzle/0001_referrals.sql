-- Referral registry + page-view attribution.
-- Safe to run against an existing production database: all existing ratings
-- keep a NULL referral_visit_id.

create table if not exists "public"."referrals" (
  "id"               text primary key,
  "source_type"      text not null default 'manual'
                       check (source_type in ('manual', 'x_share')),
  "source_rating_id" uuid references "public"."ratings"("id") on delete set null,
  "created_at"       timestamp with time zone not null default now()
);

create index if not exists "referrals_source_rating_idx"
  on "public"."referrals" ("source_rating_id");

create table if not exists "public"."referral_visits" (
  "id"           uuid primary key default gen_random_uuid(),
  "referral_id"  text not null references "public"."referrals"("id") on delete cascade,
  "landing_path" text not null default '/',
  "created_at"   timestamp with time zone not null default now()
);

create index if not exists "referral_visits_referral_created_idx"
  on "public"."referral_visits" ("referral_id", "created_at");

alter table "public"."ratings"
  add column if not exists "referral_visit_id" uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'ratings_referral_visit_id_fkey'
      and conrelid = 'public.ratings'::regclass
  ) then
    alter table "public"."ratings"
      add constraint "ratings_referral_visit_id_fkey"
      foreign key ("referral_visit_id")
      references "public"."referral_visits"("id")
      on delete set null;
  end if;
end
$$;

create index if not exists "ratings_referral_visit_idx"
  on "public"."ratings" ("referral_visit_id");

create or replace view "public"."referral_performance" as
select
  ref.id as referral_id,
  ref.source_type,
  ref.source_rating_id,
  ref.created_at,
  count(distinct visit.id)::integer as page_views,
  count(distinct case when rating.id is not null then visit.id end)::integer
    as converting_visits,
  count(rating.id)::integer as ratings,
  case
    when count(distinct visit.id) = 0 then 0::double precision
    else count(distinct case when rating.id is not null then visit.id end)::double precision
      / count(distinct visit.id)::double precision
  end as visit_conversion_rate,
  max(visit.created_at) as last_viewed_at
from "public"."referrals" ref
left join "public"."referral_visits" visit
  on visit.referral_id = ref.id
left join "public"."ratings" rating
  on rating.referral_visit_id = visit.id
group by ref.id, ref.source_type, ref.source_rating_id, ref.created_at;
