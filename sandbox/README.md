# sandbox/ — deprecated (v1)

This folder was for running the grader inside an **E2B sandbox** via the
Claude Agent SDK. We decided against that approach: it's 50–100× more
expensive than a direct two-pass Claude call and adds infrastructure for
no scoring benefit.

The current pipeline lives in `lib/agent/run.ts`:

1. Fetch user + repos + events in parallel
2. Pick top 3 non-fork repos
3. Pass 1 (Sonnet 4.6): ingest trees + READMEs → JSON of files to read
4. Parallel fetch those files
5. Compute server-side stats (heatmap, night-owl index, graveyard count)
6. Pass 2 (Sonnet 4.6): full rating against the rubric

No sandbox. No agent loop. ~45 s, ~$0.25 per profile.

Kept here for reference — restoring the E2B path would mean:
- re-installing `e2b` and building this Dockerfile
- flipping `lib/agent/run.ts` to call `runInSandbox()` (deleted in v2)
- reintroducing the 300 s function budget

See `SETUP.md` for the live setup.
