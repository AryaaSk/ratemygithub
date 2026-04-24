# RateMyGitHub — setup + run

Everything you need to take a fresh clone to a working viral demo. ~15
minutes end-to-end. $0 to boot; ~$0.25 per real rating once live.

**Architecture (v2, simplified):** two-pass Claude call directly in a Next.js
API route. No sandbox. No agent loop. 45 s per profile, hard-capped at 60 s.

---

## 0 · Prereqs

```bash
node --version       # 20.x+
pnpm --version       # 10.x. If missing: npm i -g pnpm
cd ~/Desktop/ratemygithub
cp .env.example .env.local
pnpm install
```

Open `.env.local` in your editor — you'll fill it as you go.

---

## 1 · Supabase (Postgres + Realtime)  — 5 min

Stores users, ratings, jobs. Realtime streams leaderboard updates to the
browser.

1. [supabase.com](https://supabase.com) → *New project*. Region near `iad1` (default Vercel region). Save the DB password.
2. Once provisioned: *Project Settings → API* — copy into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<project url>
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service_role>
   ```
3. *Settings → Database → Connection string → URI → Transaction pooler (6543)*. Copy → `DATABASE_URL`.
4. *SQL Editor* → paste the contents of `drizzle/0000_init.sql` → *Run*. Creates tables, indexes, and the Realtime publication.

Free tier (500 MB DB + 2 GB egress) is plenty.

---

## 2 · Upstash (QStash + Redis)  — 4 min

Scoring takes ~45 s per profile — too long for a direct HTTP request.
QStash queues the work; the browser polls `/api/rate/:id`. Redis holds the
rate-limit counters.

1. [upstash.com](https://upstash.com) → sign in.

**QStash** (left nav → QStash dashboard). Copy:
```
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=
```

**Redis** — *Create database*:
- Name: `rmg-ratelimits`, same region as Supabase, Free plan.
- Open → *Details* → copy `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`.

**Dev bypass** (so `pnpm start` can call the worker without real signatures):
```bash
openssl rand -hex 16
```
Paste as `DEV_QSTASH_BYPASS_SECRET`.

---

## 3 · Anthropic  — 2 min

Both scoring passes run against the Anthropic API.

1. [console.anthropic.com](https://console.anthropic.com) → *API Keys → Create Key*.
2. Paste as `ANTHROPIC_API_KEY`.
3. *Plans & Billing → Spend limit* — set a monthly cap (e.g. $50). With
   the per-login daily lock + spend cap, runaway cost is impossible.

---

## 4 · GitHub token  — 1 min

Effectively required: each rating fires ~25 GitHub API calls. Anonymous
limit is 60/hr → you'd throttle after ~2 profiles. Authenticated: 5000/hr.

1. [github.com/settings/tokens](https://github.com/settings/tokens) → *Fine-grained → Generate new token*.
2. Public repos read-only is enough. No scopes beyond `public_repo` read.
3. Paste as `GITHUB_TOKEN`.

---

## 5 · Optional — Cloudflare Turnstile (before public launch)

[dash.cloudflare.com → Turnstile](https://dash.cloudflare.com) → add a
site → copy site + secret keys. Paste as
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY`. Soft-disabled
until set — local dev doesn't need it.

---

## 6 · Run locally

Because `next dev` currently leaks memory on this machine (Turbopack
watcher issue — see project memory notes), run the production build
instead:

```bash
pnpm build
pnpm start
# → http://localhost:3000
```

`pnpm start` is a fixed, watcher-free Node server. Ctrl-C to stop.

**Smoke test:**

1. Open `http://localhost:3000`. Leaderboard shows mock rows until someone submits.
2. Enter a real username (e.g. `torvalds`). Confirm modal shows their GitHub avatar. Click **Rate Me**.
3. Hero reports `warming up…` → `scraping…` → you land on `/u/torvalds`.
4. Open a second tab on `/` — the leaderboard updates in it without reload (Supabase Realtime).

**Troubleshooting mode:** set `AGENT_MODE=mock` in `.env.local`, restart,
and `/api/rate` still writes real DB rows but the grader returns a
deterministic fake rating per login. Good for wiring + UI work without
burning Anthropic credits.

---

## 7 · Deploy to Vercel  — 5 min

1. [vercel.com/new](https://vercel.com/new) → *Import Git Repository* → select `ratemygithub`.
2. Framework: Next.js (auto-detected).
3. *Environment Variables* — paste everything from `.env.local` **plus**:
   ```
   APP_URL=https://<your-app>.vercel.app
   ```
4. *Deploy*.
5. **Critical**: *Project → Settings → Functions → Max Duration* → **60 s**. `/api/worker` runs the 45 s two-pass pipeline; default 10 s will kill it mid-scoring. Vercel Pro required.

Test prod with a real rating:
```bash
curl -X POST https://<your-app>.vercel.app/api/rate \
  -H 'content-type: application/json' \
  -d '{"login":"gaearon"}'
# → {"jobId":"…","login":"gaearon","status":"queued"}
```

Watch the row land in Supabase → Table Editor → `ratings`.

---

## 8 · Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `DATABASE_URL not set` | env missing | Reload after editing `.env.local` |
| `GitHub returned 403` on validate | Rate-limited | Add `GITHUB_TOKEN` |
| Confirm modal never opens | Username regex fails | Must match `^[A-Za-z0-9][A-Za-z0-9-]*` with no trailing hyphen |
| `pnpm start` → port busy | Prior run still up | `lsof -i :3000` → `kill <pid>` |
| Job fails with `Zod error` | Model drifted on output shape | Retry is safe (idempotent). If persistent, bump `RUBRIC_VERSION` in `lib/scoring/rubric.ts` and tighten `lib/scoring/schema.ts` |
| `Unauthorized` on `/api/worker` in prod | QStash signing-key mismatch | Rotate both signing keys |
| Leaderboard doesn't live-update | Realtime publication missing | Re-run the SQL from `drizzle/0000_init.sql` (the publication lines at the bottom) |
| Rating times out after 60 s | Slow GitHub call | Retry. If repeated, the user has a huge profile — drop `TARGET_REPOS` in `lib/agent/run.ts` from 3 to 2 |

---

## 9 · What's where

- **UI pages**: `app/page.tsx`, `app/u/[login]/page.tsx`, `app/style/page.tsx`
- **API routes**: `app/api/{rate,rate/[id],worker,leaderboard,og/[login]}/route.ts`
- **Scoring pipeline (two-pass)**: `lib/agent/run.ts` + `lib/agent/system-prompt.ts`
- **GitHub fetchers + server-side stats**: `lib/github/{fetcher,stats,validate}.ts`
- **DB**: `lib/db/{schema,client,queries}.ts` + `drizzle/0000_init.sql`
- **Security gates**: `lib/github/validate.ts`, `lib/ratelimit.ts`, `lib/turnstile.ts`, `lib/queue.ts`
- **Rubric (single source of truth)**: `lib/scoring/rubric.ts` + `lib/scoring/schema.ts`
- **Design system**: `components/arcade/*` + `app/globals.css`
- **Zoral branding**: `components/zoral/banner.tsx` + footer in `app/page.tsx` + OG route + share text
- **Mock fixture (dev fallback)**: `lib/mock.ts`

---

## 10 · Cost control checklist

- [x] 1 rating per GitHub login / 24 h — hard cap in `lib/ratelimit.ts`
- [x] 5 submissions per IP / hour
- [x] Anthropic monthly spend cap (set in step 3)
- [x] Vercel function hard-caps at 60 s (kills stuck jobs before they accumulate cost)
- [x] QStash `deduplicationId: rate:<login>` collapses duplicate submits
- [x] `TARGET_REPOS = 3` in `lib/agent/run.ts` caps Pass 2 context size

---

## 11 · Viral-play checklist (pre-YC HQ field trip)

- [ ] Prize decided (Zoral hoodie / sticker / $50 gift card — pick one)
- [ ] OG share card renders correctly when pasted into X compose (`/api/og/<login>`)
- [ ] Zoral banner visible on every screen you plan to film
- [ ] Mic-test the phone's audio (you need their reaction audible)
- [ ] A running demo URL you can hand over in a 30-second ask
