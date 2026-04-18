"use client";

import { useState } from "react";
import type { CategoryKey } from "@/lib/scoring/rubric";
import { CATEGORIES, TIERS } from "@/lib/scoring/rubric";
import { cn } from "@/lib/utils";

type Props = {
  scores: Record<CategoryKey, number>;
  reasoning?: Partial<Record<CategoryKey, string[]>>;
  overallScore: number;
  login: string;
};

/**
 * Transparent explanation of the rubric, per-category evidence, and how the
 * overall score was produced. Each category row is collapsible — click to
 * see what the category measures plus the specific evidence the grader used
 * for THIS profile.
 */
export function RubricFooter({ scores, reasoning = {}, overallScore, login }: Props) {
  const [open, setOpen] = useState<CategoryKey | null>(null);

  const rows = CATEGORIES.map((c) => {
    const s = Math.max(0, Math.min(100, scores[c.key] ?? 0));
    return {
      key: c.key,
      label: c.label,
      weight: c.weight,
      score: s,
      contribution: +(s * c.weight).toFixed(2),
      blurb: c.blurb,
      evidence: reasoning[c.key] ?? [],
    };
  });
  const rawTotal = rows.reduce((a, r) => a + r.contribution, 0);
  const curveDelta = +(overallScore - rawTotal).toFixed(1);

  return (
    <section className="pixel-border-sm bg-arcade-cream-soft dark:bg-arcade-dark-soft p-4 sm:p-6 space-y-5">
      <header>
        <p className="font-pixel text-[10px] uppercase tracking-widest text-arcade-red">
          How this score was produced
        </p>
        <h3 className="font-pixel text-xs sm:text-sm mt-2">
          Overall = Σ (category × weight) + gentle top-end curve
        </h3>
      </header>

      <div className="space-y-1">
        <div
          className="grid grid-cols-[1fr_48px_44px_56px_20px] sm:grid-cols-[1fr_80px_60px_90px_24px] gap-2 px-3 py-1 font-pixel text-[9px] uppercase tracking-widest opacity-60"
        >
          <span>Category</span>
          <span className="text-right">Weight</span>
          <span className="text-right">Score</span>
          <span className="text-right">Contrib.</span>
          <span />
        </div>

        {rows.map((r) => {
          const isOpen = open === r.key;
          return (
            <div
              key={r.key}
              className={cn(
                "pixel-border-sm bg-arcade-cream dark:bg-arcade-dark transition-colors",
                isOpen && "bg-arcade-cream-soft dark:bg-arcade-dark-soft",
              )}
              style={{ boxShadow: "none" }}
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.key)}
                className="w-full grid grid-cols-[1fr_48px_44px_56px_20px] sm:grid-cols-[1fr_80px_60px_90px_24px] gap-2 items-center px-3 py-2.5 text-left hover:bg-arcade-cream-soft dark:hover:bg-arcade-dark-soft transition-colors"
                aria-expanded={isOpen}
              >
                <span className="font-pixel text-xs">{r.label}</span>
                <span className="text-right font-mono tabular-nums text-xs opacity-80">
                  {Math.round(r.weight * 100)}%
                </span>
                <span className="text-right font-mono tabular-nums text-sm sm:text-base">
                  {r.score}
                </span>
                <span className="text-right font-mono tabular-nums text-sm sm:text-base">
                  {r.contribution.toFixed(1)}
                </span>
                <span
                  className={cn(
                    "font-pixel text-[10px] transition-transform",
                    isOpen && "rotate-90",
                  )}
                >
                  ▸
                </span>
              </button>

              {isOpen && (
                <div className="border-t border-arcade-ink/15 dark:border-arcade-cream/15 px-3 py-3 space-y-3 text-xs">
                  <div>
                    <p className="font-pixel text-[9px] uppercase tracking-widest opacity-60 mb-1">
                      What it measures
                    </p>
                    <p className="opacity-90">{r.blurb}</p>
                  </div>
                  <div>
                    <p className="font-pixel text-[9px] uppercase tracking-widest opacity-60 mb-1">
                      Evidence for {login}
                    </p>
                    {r.evidence.length === 0 ? (
                      <p className="opacity-60 italic">
                        No per-category evidence recorded (this rating was
                        produced before the rubric footer existed — re-rate to
                        capture it).
                      </p>
                    ) : (
                      <ul className="space-y-1.5 list-none">
                        {r.evidence.map((b, i) => (
                          <li
                            key={i}
                            className="flex gap-2 leading-snug opacity-90"
                          >
                            <span
                              className="shrink-0 mt-[5px] w-1.5 h-1.5 bg-arcade-red"
                              aria-hidden
                            />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Totals row */}
        <div className="mt-3 space-y-1 px-3 py-2 font-mono tabular-nums text-xs">
          <div className="flex justify-between">
            <span className="font-pixel text-[10px] uppercase tracking-widest">
              Raw total
            </span>
            <span>{rawTotal.toFixed(1)}</span>
          </div>
          <div className="flex justify-between opacity-70">
            <span className="font-pixel text-[10px] uppercase tracking-widest">
              Top-end curve
            </span>
            <span>
              {curveDelta >= 0 ? "+" : ""}
              {curveDelta.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between border-t-2 border-arcade-ink/40 dark:border-arcade-cream/40 pt-1">
            <span className="font-pixel text-xs uppercase tracking-widest text-arcade-red">
              Final overall
            </span>
            <span className="font-score text-xl text-arcade-red">
              {overallScore.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Tier thresholds */}
      <div className="space-y-2">
        <p className="font-pixel text-[9px] uppercase tracking-widest opacity-70">
          Tier thresholds
        </p>
        <div className="flex flex-wrap gap-2 text-[10px]">
          {TIERS.map((t) => (
            <span
              key={t.tier}
              className="inline-flex items-center gap-1.5 pixel-border-sm px-2 py-1"
              style={{ backgroundColor: t.color, color: "#1A1A1E", boxShadow: "none" }}
            >
              <span className="font-pixel">{t.tier}</span>
              <span className="font-mono tabular-nums">
                {t.min}–{t.max}
              </span>
              <span className="opacity-80">{t.name}</span>
            </span>
          ))}
        </div>
      </div>

      <details className="group" open>
        <summary className="cursor-pointer font-pixel text-[10px] uppercase tracking-widest opacity-70 hover:opacity-100">
          ▸ How the pipeline works
        </summary>
        <ol className="mt-3 space-y-2 text-xs leading-relaxed list-none">
          <li className="flex gap-3">
            <span className="font-pixel text-[10px] text-arcade-red shrink-0 w-8">
              01
            </span>
            <span className="opacity-90">
              <strong>Scrape.</strong> Pull every non-fork repo pushed in the
              last 90 days, plus your contribution calendar, followers, and
              language byte counts — straight from GitHub&apos;s REST &amp;
              GraphQL APIs.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-pixel text-[10px] text-arcade-red shrink-0 w-8">
              02
            </span>
            <span className="opacity-90">
              <strong>Triage.</strong> A small model reads every repo&apos;s
              file tree + README and picks the 20 files per repo that actually
              reveal how you code.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-pixel text-[10px] text-arcade-red shrink-0 w-8">
              03
            </span>
            <span className="opacity-90">
              <strong>Grade each repo.</strong> All repos run in parallel
              through a fast scoring model that reads the picked files and
              rates each one independently on Impact, Quality, and Depth —
              with evidence citations.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-pixel text-[10px] text-arcade-red shrink-0 w-8">
              04
            </span>
            <span className="opacity-90">
              <strong>Aggregate.</strong> A larger reasoning model combines
              the per-repo scores with server-computed stats (heatmap,
              commit cadence, language entropy, follower count) to produce
              the 6-dimension profile score + roasts.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-pixel text-[10px] text-arcade-red shrink-0 w-8">
              05
            </span>
            <span className="opacity-90">
              <strong>Correct.</strong> Deterministic server-side checks
              enforce anchor-scale floors (e.g. a profile with 2,000+ public
              commits can&apos;t score 30 Consistency) and recompute the final
              verdict.
            </span>
          </li>
        </ol>
        <p className="mt-4 text-[11px] opacity-60 leading-relaxed">
          ~90 seconds per profile, ~$0.25 in compute. Total of ~240 files read
          across your top-12 repos. One rating per GitHub account per day.
        </p>
      </details>

      <details className="group">
        <summary className="cursor-pointer font-pixel text-[10px] uppercase tracking-widest opacity-70 hover:opacity-100">
          ▸ Data sources &amp; caveats
        </summary>
        <ul className="mt-3 space-y-1.5 text-xs opacity-80 leading-relaxed">
          <li>
            <strong>Heatmap &amp; commit totals:</strong> GitHub GraphQL{" "}
            <code>contributionsCollection</code> — covers the last 365 days,
            includes private repos when the user has opted in (default).
          </li>
          <li>
            <strong>Language %:</strong> byte totals across the top 30 owned
            non-fork repos.
          </li>
          <li>
            <strong>Curve:</strong> a small upward nudge centered on raw score
            ≈ 70, capping at 100. Prevents specialists from being unfairly
            penalised for narrow breadth.
          </li>
          <li>
            <strong>Anchor corrections:</strong> when server-measured signals
            (e.g. privateWorkLikely, multiRepoVolume, follower count) mandate a
            minimum category score, the aggregation step enforces it. These are
            signal-conditional, not identity-based floors.
          </li>
        </ul>
      </details>
    </section>
  );
}
