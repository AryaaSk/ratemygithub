# RateMyGitHub

Arcade-style public scoring of any GitHub profile. Enter a username, wait ~90 seconds, get a verdict across 6 rubric dimensions with per-repo evidence and a shareable OG card. Powered by a three-pass AI pipeline reading your actual code, not just your stats.

Built using [AliasKit](https://aliaskit.com) — identity infra for AI agents.

---

## What it does

1. You enter a GitHub username.
2. We scrape every public repo pushed in the last 90 days + the last 365 days of contribution data + language byte counts, all via GitHub's REST + GraphQL APIs.
3. An AI pipeline reads the actual source code of the top ~12 repos and grades each on Impact, Quality, and Depth with cited evidence.
4. A second aggregation model blends those per-repo scores with server-computed stats into a 6-dimension profile score (Impact · Consistency · Quality · Depth · Breadth · Community).
5. You get a tier (S → F), a percentile, an OG share card, and 3–5 personalised roasts. All in ~90 seconds for ~$0.25 in compute.

The scoring calibration was tuned so that:

- `torvalds` → S tier (92/100) — linux earns its 95/95/95 per-repo
- An active indie builder with ~10 shipped projects → C tier (~64/100)
- An empty throwaway account → F tier (<30)

## Three-pass pipeline

```
     ┌─────────────────────────────────────────────────────┐
     │  GitHub REST + GraphQL (parallel fetches)           │  1–2 s
     │  user · repos · events · contributionsCollection    │
     └────────────────────────┬────────────────────────────┘
                              │
     ┌────────────────────────▼────────────────────────────┐
     │  Pass 1 — file selection  (Sonnet 4.6, 1 call)      │  5–8 s
     │  Reads every repo's file tree + README, picks the   │
     │  ≤ 20 files per repo that actually reveal craft.    │
     └────────────────────────┬────────────────────────────┘
                              │
     ┌────────────────────────▼────────────────────────────┐
     │  Pass 2 — per-repo scoring  (Haiku 4.5, N parallel) │ 10–15 s
     │  One call per repo. Reads selected files + author-  │
     │  itative presence flags (HAS_README, HAS_TESTS,     │
     │  HAS_CI, …), emits {impact, quality, depth,         │
     │  evidence[]}.                                        │
     └────────────────────────┬────────────────────────────┘
                              │
     ┌────────────────────────▼────────────────────────────┐
     │  Pass 3 — profile aggregation  (Sonnet 4.6, 1 call) │ 60–70 s
     │  Combines per-repo scores with server stats →       │
     │  final 6-dim category scores, roasts, timeline.     │
     └────────────────────────┬────────────────────────────┘
                              │
     ┌────────────────────────▼────────────────────────────┐
     │  Deterministic server corrections (Node)            │  < 1 s
     │  Enforces anchor floors (e.g. `privateWorkLikely` → │
     │  Consistency ≥ 55), reconciles repos + timeline     │
     │  against the real repo list, recomputes overall.    │
     └─────────────────────────────────────────────────────┘
```

Total wall-clock: ~90 s end-to-end. Everything runs inside a single Vercel function invocation — no queue, no worker, no cross-service handoff. The parallel Pass 2 calls are just `Promise.all` against the Anthropic API.

## Rubric

Six dimensions, weighted:

| Category | Weight | Signal |
|---|---|---|
| **Impact** | 25% | Log-scaled stars + forks + followers + active-portfolio breadth |
| **Consistency** | 20% | Contribution calendar, commit cadence, private-work-likely correction |
| **Quality** | 20% | README, tests, CI, types, structured layout — read from actual files |
| **Depth** | 15% | Sustained work on flagship repos + horizontal multi-repo output |
| **Breadth** | 10% | Language entropy and project-type diversity |
| **Community** | 10% | Followers, external PRs, follower-to-following ratio |

Tiers: S (90–100) · A (80–89) · B (70–79) · C (60–69) · D (40–59) · F (0–39)

Each category has a concrete anchor scale defined in [`lib/agent/system-prompt.ts`](lib/agent/system-prompt.ts). Server-side corrections in [`lib/agent/run.ts`](lib/agent/run.ts) enforce signal-conditional floors — never identity-based — so active indie builders don't get buried by low star counts and kernel maintainers don't slip out of S tier.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) + TypeScript | Single codebase, edge + node routes |
| UI | Tailwind v4 + custom pixel-arcade system | Chunky pixel borders + CRT scanlines + no gradients |
| Charts | recharts | Radar, donut, bars |
| Fonts | `Press Start 2P`, `VT323`, `Geist` | Arcade heads, SNES score digits, readable body |
| DB | Supabase Postgres + Drizzle ORM | Managed Postgres with Realtime for live leaderboard |
| AI | Anthropic Sonnet 4.6 + Haiku 4.5 | Sonnet for reasoning, Haiku for parallel scoring |
| GitHub | REST + GraphQL, PAT auth | GraphQL for `contributionsCollection` + language bytes |
| Deploy | Vercel (functions up to 60 s) | Matches the ~90-s-p95 wall clock with generous margin |

No queue. No sandbox. No worker process. Everything lives in one `/api/rate` function.

## Project layout

```
app/
  page.tsx                    # landing (hero + leaderboard)
  u/[login]/page.tsx          # profile dossier
  style/page.tsx              # design-system showcase
  api/
    rate/route.ts             # validate + score + persist (one function)
    leaderboard/route.ts      # top / recent / shame
    profile/[login]/route.ts  # JSON for compare widget
    og/[login]/route.tsx      # OG image for share cards
components/
  arcade/                     # TierMedal, ScoreCounter, PixelBorder, Scanlines
  landing/                    # HeroCard, LeaderboardPanel
  leaderboard/                # Row, TabStrip
  profile/                    # Radar, Heatmap, RepoCard, RoastTags,
                              # Timeline, CompareWidget, RubricFooter
  forms/                      # UsernameInput, EmailInput, ConfirmModal
lib/
  agent/
    run.ts                    # three-pass orchestration + server corrections
    system-prompt.ts          # Pass 1/2/3 prompts with rubric anchors
    wrap-untrusted.ts
  github/
    fetcher.ts                # REST + GraphQL wrappers
    stats.ts                  # server-computed stats + presence flags
    validate.ts               # regex + live existence check (security gate)
  scoring/
    rubric.ts                 # single source of truth: weights, tiers, curve
    schema.ts                 # Zod schema for agent output
    normalize.ts              # graceful coercion before Zod
  db/
    schema.ts                 # Drizzle tables
    client.ts                 # lazy Postgres connection
    queries.ts                # typed read/write helpers
drizzle/
  0000_init.sql               # run once in Supabase SQL Editor
```

## Run it

1. **Clone + install**
   ```bash
   git clone <this-repo> && cd ratemygithub
   pnpm install
   cp .env.example .env.local
   ```

2. **Supabase** — [supabase.com](https://supabase.com) → new project.
   Copy `DATABASE_URL` (pooled, port 6543), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` into `.env.local`.
   Run `drizzle/0000_init.sql` in the SQL Editor.

3. **Anthropic** — [console.anthropic.com](https://console.anthropic.com) API key → `ANTHROPIC_API_KEY`. Set a monthly spend cap.

4. **GitHub** — Fine-grained PAT with `public_repo:read` → `GITHUB_TOKEN`. Required, not optional: each rating burns ~25 API calls.

5. **Boot**
   ```bash
   pnpm build
   pnpm start
   # → http://localhost:3000
   ```

6. **Rate something**
   ```bash
   curl -X POST http://localhost:3000/api/rate \
     -H 'content-type: application/json' \
     -d '{"login":"torvalds"}'
   ```
   Wait ~90 s. Result lands in Supabase `ratings` table and `/u/torvalds` renders the dossier.

See [`SETUP.md`](SETUP.md) for the full walkthrough including optional Cloudflare Turnstile + Upstash rate limits.

## Security model

User-supplied usernames flow into an LLM-driven pipeline, so validation matters. The pipeline:

- Enforces GitHub's username regex client-side AND server-side
- Calls `GET /users/{login}` to verify the user exists and has `type: "User"` (rejects orgs, bots, nonexistent accounts)
- Passes the validated login to the AI pipeline as a structured tool argument — NEVER concatenated into a prompt
- Wraps all repo-sourced content (READMEs, source files, commit messages) in `<untrusted>…</untrusted>` tags before the model reasons over it
- Rejects any Pass 2 / Pass 3 output that doesn't parse against the Zod schema
- Caps every rating at one per GitHub account per 24 h (cost-control AND anti-abuse)

See [`lib/github/validate.ts`](lib/github/validate.ts) and [`lib/agent/wrap-untrusted.ts`](lib/agent/wrap-untrusted.ts) for the perimeter.

## Cost + latency budget

Per rating, typical profile (6 recent repos):

| Stage | Tokens | Cost |
|---|---|---|
| Pass 1 (Sonnet 4.6) | ~12 k in / 1 k out | ~$0.04 |
| Pass 2 (Haiku 4.5, ×6 parallel) | ~40 k in / 3 k out total | ~$0.05 |
| Pass 3 (Sonnet 4.6) | ~15 k in / 3 k out | ~$0.10 |
| **Total** | **~70 k in / 7 k out** | **~$0.20** |

Large profiles (12 recent repos) scale to ~$0.30. Server logs print the per-model breakdown after every rating.

Wall clock p50 ~ 75 s, p95 ~ 105 s. Vercel function max duration: 60 s on Hobby, 300 s on Pro. Pro recommended.

## Calibration knobs

All scoring calibration lives in two files:

- [`lib/agent/system-prompt.ts`](lib/agent/system-prompt.ts) — the anchor scales (`95 = linux, 80 = tanstack/query, …`) for each category. Change these to shift the whole rating surface.
- [`lib/agent/run.ts`](lib/agent/run.ts) — deterministic server corrections. Floors and bumps triggered by server-measured signals (`privateWorkLikely`, `multiRepoVolume`, `realProjects`, follower count). Never identity-based.

The curve applied to the final overall score (gentle upward nudge centered at 70, capping at 100) lives in [`lib/scoring/rubric.ts`](lib/scoring/rubric.ts).

## License

MIT. Do whatever.
