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
        <div className="flex items-baseline gap-1">
          <span className="font-score text-3xl tabular-nums" style={{ color: t.color }}>
            {repo.score}
          </span>
          <span className="font-pixel text-[9px] opacity-60">/100</span>
        </div>
      </div>

      <p className="text-xs leading-relaxed opacity-80">{repo.summary}</p>

      <div className="flex items-center gap-3 font-pixel text-[9px] uppercase opacity-80">
        <span>{repo.language}</span>
        <span>★ {repo.stars.toLocaleString()}</span>
        <span>{recency}</span>
      </div>
    </a>
  );
}
