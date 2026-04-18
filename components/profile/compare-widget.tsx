"use client";

import { useState } from "react";
import Link from "next/link";
import { PixelButton } from "@/components/arcade/pixel-button";
import { CategoryRadar } from "@/components/profile/radar";
import type { CategoryKey } from "@/lib/scoring/rubric";
import { CATEGORIES } from "@/lib/scoring/rubric";

const MEDIAN: Record<CategoryKey, number> = Object.fromEntries(
  CATEGORIES.map((c) => [c.key, 55]),
) as Record<CategoryKey, number>;

type Props = {
  self: Record<CategoryKey, number>;
  selfLogin: string;
};

type FetchState =
  | { kind: "idle" }
  | { kind: "loading"; target: string }
  | {
      kind: "ok";
      target: string;
      scores: Record<CategoryKey, number>;
      score: number;
    }
  | { kind: "not_rated"; target: string }
  | { kind: "error"; target: string; message: string };

export function CompareWidget({ self, selfLogin }: Props) {
  const [target, setTarget] = useState("");
  const [state, setState] = useState<FetchState>({ kind: "idle" });

  async function onCompare() {
    const t = target.trim();
    if (!t) return;
    setState({ kind: "loading", target: t });
    try {
      const res = await fetch(`/api/profile/${encodeURIComponent(t)}`);
      if (res.status === 404) {
        setState({ kind: "not_rated", target: t });
        return;
      }
      if (!res.ok) {
        setState({
          kind: "error",
          target: t,
          message: `Lookup failed (${res.status})`,
        });
        return;
      }
      const body = await res.json();
      setState({
        kind: "ok",
        target: body.login ?? t,
        scores: body.categoryScores,
        score: body.score,
      });
    } catch (err) {
      setState({
        kind: "error",
        target: t,
        message: (err as Error).message,
      });
    }
  }

  function onReset() {
    setState({ kind: "idle" });
    setTarget("");
  }

  const compareLabel =
    state.kind === "ok" ? state.target : "median coder";
  const compareScores = state.kind === "ok" ? state.scores : MEDIAN;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block font-pixel text-[9px] uppercase tracking-widest opacity-80 mb-1">
            Compare {selfLogin} against
          </label>
          <div className="flex items-stretch pixel-border-sm bg-arcade-cream dark:bg-arcade-dark-soft">
            <span className="flex items-center px-2 font-pixel text-[9px] uppercase opacity-70 border-r border-arcade-ink dark:border-arcade-cream">
              github.com/
            </span>
            <input
              value={target}
              onChange={(e) => setTarget(e.target.value.trim())}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onCompare();
                }
              }}
              placeholder="another login"
              className="flex-1 bg-transparent px-2 py-2 font-score text-lg outline-none text-arcade-ink dark:text-arcade-cream"
              spellCheck={false}
              autoCapitalize="none"
            />
          </div>
        </div>
        <PixelButton
          variant="secondary"
          size="md"
          disabled={!target || state.kind === "loading"}
          onClick={onCompare}
        >
          {state.kind === "loading" ? "Looking…" : "Compare"}
        </PixelButton>
        {state.kind !== "idle" && (
          <PixelButton variant="ghost" size="md" onClick={onReset}>
            Reset
          </PixelButton>
        )}
      </div>

      {/* Status / hint zone */}
      {state.kind === "not_rated" && (
        <div className="pixel-border-sm bg-arcade-yellow text-arcade-ink p-3 text-xs space-y-2">
          <p className="font-pixel text-[10px] uppercase tracking-widest">
            {state.target} hasn&apos;t been rated yet
          </p>
          <p>
            We only let you compare against profiles that already have a
            rating. Rating takes ~45 seconds and costs real API budget — we
            don&apos;t auto-rate from this box.
          </p>
          <Link
            href="/"
            className="inline-block font-pixel text-[10px] uppercase tracking-widest underline underline-offset-4"
          >
            Rate {state.target} on the home page →
          </Link>
        </div>
      )}
      {state.kind === "error" && (
        <div className="pixel-border-sm bg-arcade-yellow text-arcade-ink p-3 text-xs font-pixel uppercase tracking-widest">
          ✕ {state.message}
        </div>
      )}

      <div className="flex items-center gap-4 font-pixel text-[9px] uppercase">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-arcade-red pixel-border-sm" />
          {selfLogin} · {self ? Object.values(self).length : 0}d
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-arcade-blue pixel-border-sm" />
          {compareLabel}
          {state.kind === "ok" && (
            <span className="opacity-70">· score {state.score.toFixed(1)}</span>
          )}
        </span>
      </div>
      <CategoryRadar
        scores={self}
        compareScores={compareScores}
        compareLabel={compareLabel}
      />
    </div>
  );
}
