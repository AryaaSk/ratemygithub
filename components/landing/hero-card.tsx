"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PixelButton } from "@/components/arcade/pixel-button";
import { UsernameInput, isValidGithubLogin } from "@/components/forms/username-input";
import { EmailInput } from "@/components/forms/email-input";
import { ConfirmModal } from "@/components/forms/confirm-modal";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Phase =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "scoring"; login: string; startedAt: number }
  | { kind: "done"; login: string }
  | { kind: "error"; message: string };

// [label, cumulative seconds at which this stage BECOMES current]
// Timings mapped to the actual three-pass pipeline. Total ~90s wall clock.
const STAGES: Array<[string, number]> = [
  ["INSERTING COIN",                       0],
  ["DIALING GITHUB",                       2],
  ["FETCHING YOUR PROFILE",                4],
  ["COUNTING YOUR REPOS",                  7],
  ["SCANNING LAST 90 DAYS OF WORK",       10],
  ["BUILDING YOUR FILE TREE",             13],
  ["ASKING CLAUDE WHICH FILES MATTER",    16],
  ["READING YOUR ACTUAL CODE",            22],
  ["JUDGING EACH REPO IN PARALLEL",       28],
  ["HUNTING FOR MISSING READMES",         36],
  ["MEASURING YOUR COMMIT CADENCE",       44],
  ["CROSS-REFERENCING AGAINST TORVALDS",  52],
  ["AGGREGATING SIX DIMENSIONS",          60],
  ["COMPARING YOU TO THE MEDIAN CODER",   68],
  ["WRITING PERSONALISED ROASTS",         76],
  ["SEALING YOUR VERDICT",                84],
];
const ESTIMATED_TOTAL = 90;

// Rotating sub-message shown below the main stage line. Cycles every ~3s
// while waiting. Adds personality while the bar fills.
const FLAVOR_LINES = [
  "> filtering forks, tutorials, and hello-worlds",
  "> calculating your graveyard-to-flagship ratio",
  "> parsing your commit messages for self-burns",
  "> weighing your typedLang flag",
  "> checking if your tests actually run",
  "> following the log10(stars) adoption curve",
  "> applying the gentle upward curve past 70",
  "> normalising heatmap to 52 × 7",
  "> pulling the contributions graph you forgot about",
  "> counting .gitignore as a personality trait",
  "> asking haiku-4.5 to grade your flagship repo",
  "> asking sonnet-4.6 to aggregate the verdict",
];

export function HeroCard() {
  const router = useRouter();
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  const loginOk = isValidGithubLogin(login);
  const emailOk = email === "" || EMAIL_RE.test(email);
  const canSubmit = loginOk && emailOk;

  async function submit() {
    setPhase({ kind: "scoring", login, startedAt: Date.now() });
    try {
      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ login, email: email || undefined }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPhase({
          kind: "error",
          message: body?.error ?? `Rejected (HTTP ${res.status}).`,
        });
        return;
      }
      const canonicalLogin = (body.login as string) ?? login;
      setPhase({ kind: "done", login: canonicalLogin });
      router.push(`/u/${canonicalLogin}`);
    } catch (err) {
      setPhase({
        kind: "error",
        message: `Couldn't reach the server — ${(err as Error).message}`,
      });
    }
  }

  const busy = phase.kind === "scoring";

  // Tick every 250ms while scoring so the progress bar moves smoothly.
  const [, force] = useState(0);
  useEffect(() => {
    if (!busy) return;
    const id = setInterval(() => force((n) => n + 1), 250);
    return () => clearInterval(id);
  }, [busy]);

  let stageIdx = 0;
  let barPct = 0;
  let elapsedSec = 0;
  let flavorLine = "";
  if (phase.kind === "scoring") {
    elapsedSec = (Date.now() - phase.startedAt) / 1000;
    // Asymptote: ease-out so the bar slows as it approaches 95%. Keeps
    // the perceived speed honest when we go over-budget.
    const progress = Math.min(1, elapsedSec / ESTIMATED_TOTAL);
    const eased = 1 - Math.pow(1 - progress, 1.4);
    barPct = Math.min(95, eased * 95);

    // Find the current stage: the last stage whose start-time has passed.
    for (let i = 0; i < STAGES.length; i++) {
      if (elapsedSec >= STAGES[i][1]) stageIdx = i;
    }

    // Rotate a flavor line every ~3s; offset by the stage index so the
    // two text lines don't change in lockstep.
    const flavorIdx =
      (Math.floor(elapsedSec / 3) + stageIdx) % FLAVOR_LINES.length;
    flavorLine = FLAVOR_LINES[flavorIdx];
  }

  return (
    <div className="pixel-border bg-arcade-cream-soft dark:bg-arcade-dark-soft p-5 sm:p-8">
      <div className="mb-6 pb-5 border-b-2 border-arcade-ink/15 dark:border-arcade-cream/15 flex items-baseline justify-between gap-3">
        <h1 className="font-pixel text-base sm:text-lg md:text-xl tracking-tight leading-none">
          RATE MY GITHUB
        </h1>
        <Link
          href="/style"
          className="font-pixel text-[9px] sm:text-[10px] uppercase tracking-widest opacity-60 hover:opacity-100 hover:text-arcade-red"
        >
          Style
        </Link>
      </div>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit && !busy) setPhase({ kind: "confirming" });
        }}
      >
        <UsernameInput id="login" value={login} onChange={setLogin} />
        <EmailInput id="email" value={email} onChange={setEmail} />
        {email && !emailOk && (
          <p className="font-pixel text-[9px] uppercase text-arcade-red">
            Email looks off — double-check it or leave it blank.
          </p>
        )}

        {phase.kind === "scoring" && (
          <div className="pixel-border-sm bg-arcade-cream dark:bg-arcade-dark px-3 py-3 space-y-2">
            <div className="flex items-baseline justify-between gap-3">
              <p className="font-pixel text-[10px] sm:text-[11px] uppercase tracking-widest text-arcade-ink">
                ▸ {STAGES[stageIdx]?.[0] ?? "STILL SCORING"}…
              </p>
              <p className="font-score text-sm tabular-nums opacity-70">
                {elapsedSec.toFixed(1)}s / ~{ESTIMATED_TOTAL}s
              </p>
            </div>
            <div className="h-2 bg-arcade-ink/15 overflow-hidden">
              <div
                className="h-full bg-arcade-red transition-[width] duration-200 ease-out"
                style={{ width: `${barPct}%` }}
              />
            </div>
            <p className="font-mono text-[10px] opacity-60 truncate">
              {flavorLine}
            </p>
          </div>
        )}
        {phase.kind === "error" && (
          <p className="font-pixel text-[10px] uppercase tracking-widest bg-arcade-yellow text-arcade-ink pixel-border-sm px-3 py-2">
            ✕ {phase.message}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="font-pixel text-[9px] uppercase opacity-60 max-w-[40ch]">
            Public data only.
          </p>
          <PixelButton
            type="submit"
            size="md"
            variant="primary"
            disabled={!canSubmit || busy}
          >
            {busy ? "Scoring…" : "Rate Me →"}
          </PixelButton>
        </div>
      </form>

      <ConfirmModal
        open={phase.kind === "confirming"}
        login={login}
        email={emailOk ? email : ""}
        onCancel={() => setPhase({ kind: "idle" })}
        onConfirm={submit}
      />
    </div>
  );
}
