import type { RepoScore } from "@/lib/mock";
import { tierForScore } from "@/lib/scoring/rubric";

export function RepoCard({ repo, login }: { repo: RepoScore; login: string }) {
  const t = tierForScore(repo.score);
  const last = new Date(repo.lastCommit);
  const now = new Date();
  const daysAgo = Math.floor(
    (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24),
  );
  const recency =
    daysAgo < 7
      ? "this week"
      : daysAgo < 30
        ? `${daysAgo}d ago`
        : daysAgo < 365
          ? `${Math.floor(daysAgo / 30)}mo ago`
          : `${Math.floor(daysAgo / 365)}y ago`;

  // Present per-repo sub-scores only when v3 data is available.
  const hasPerRepo =
    typeof repo.impact === "number" &&
    typeof repo.quality === "number" &&
    typeof repo.depth === "number";

  return (
    <a
      href={`https://github.com/${login}/${repo.name}`}
      target="_blank"
      rel="noreferrer"
      className="pixel-border bg-arcade-cream-soft dark:bg-arcade-dark-soft p-4 block space-y-3 hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0_0_var(--color-arcade-ink)] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-pixel text-[10px] uppercase opacity-60">
            {login} /
          </p>
          <p className="font-pixel text-sm truncate">{repo.name}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="inline-block w-2 h-6 pixel-border-sm"
            style={{ backgroundColor: t.color, boxShadow: "none" }}
            aria-hidden
          />
          <span className="font-score text-3xl tabular-nums text-arcade-ink dark:text-arcade-cream">
            {repo.score}
          </span>
          <span className="font-pixel text-[9px] opacity-60">/100</span>
        </div>
      </div>

      <p className="text-xs leading-relaxed opacity-80">{repo.summary}</p>

      {hasPerRepo && (
        <div className="flex flex-wrap items-center gap-1.5">
          <SubScorePill label="I" score={repo.impact!} hint="Impact" />
          <SubScorePill label="Q" score={repo.quality!} hint="Quality" />
          <SubScorePill label="D" score={repo.depth!} hint="Depth" />
          {repo.flags && (
            <div className="flex items-center gap-1 font-pixel text-[8px] uppercase opacity-70 ml-auto">
              {repo.flags.hasReadme && <FlagChip>README</FlagChip>}
              {repo.flags.hasTests && <FlagChip>Tests</FlagChip>}
              {repo.flags.hasCI && <FlagChip>CI</FlagChip>}
              {repo.flags.typedLang && <FlagChip>Typed</FlagChip>}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 font-pixel text-[9px] uppercase opacity-80">
        <span>{repo.language}</span>
        <span>★ {repo.stars.toLocaleString()}</span>
        <span>{recency}</span>
      </div>
    </a>
  );
}

function SubScorePill({
  label,
  score,
  hint,
}: {
  label: string;
  score: number;
  hint: string;
}) {
  const t = tierForScore(score);
  return (
    <span
      title={`${hint}: ${score}/100 (tier ${t.tier})`}
      className="inline-flex items-center gap-1 pixel-border-sm px-1.5 py-0.5 font-pixel text-[9px] uppercase tabular-nums"
      style={{
        backgroundColor: t.color,
        color: "#1A1A1E",
        boxShadow: "none",
      }}
    >
      <span>{label}</span>
      <span>{score}</span>
    </span>
  );
}

function FlagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="pixel-border-sm px-1 py-[1px] bg-arcade-cream dark:bg-arcade-dark" style={{ boxShadow: "none" }}>
      {children}
    </span>
  );
}
