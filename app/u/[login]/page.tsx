import { notFound } from "next/navigation";
import Link from "next/link";
import { profileData } from "@/lib/data";
import { tierForScore } from "@/lib/scoring/rubric";
import { TierMedal } from "@/components/arcade/tier-medal";
import { ScoreCounter } from "@/components/arcade/score-counter";
import { Avatar } from "@/components/arcade/avatar";
import { CategoryRadar } from "@/components/profile/radar";
import { CategoryBars } from "@/components/profile/category-bars";
import { CommitHeatmap } from "@/components/profile/commit-heatmap";
import { LanguageDonut } from "@/components/profile/language-donut";
import { RepoCard } from "@/components/profile/repo-card";
import { RoastTags } from "@/components/profile/roast-tags";
import { Timeline } from "@/components/profile/timeline";
import { CompareWidget } from "@/components/profile/compare-widget";
import { ShareCardButton } from "@/components/profile/share-card-button";
import { RubricFooter } from "@/components/profile/rubric-footer";

export const revalidate = 30;

type Params = { login: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { login } = await params;
  const u = await profileData(login);
  if (!u) return { title: `${login} — Rate My GitHub` };
  return {
    title: `${u.login} · ${u.score.toFixed(1)}/100 — Rate My GitHub`,
    description: `${u.login} scored ${u.score.toFixed(1)} — tier ${u.tier}.`,
    openGraph: {
      images: [{ url: `/api/og/${u.login}` }],
    },
    twitter: {
      card: "summary_large_image",
      images: [{ url: `/api/og/${u.login}` }],
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { login } = await params;
  const u = await profileData(login);
  if (!u) notFound();

  const tierDef = tierForScore(u.score);

  return (
    <div className="flex-1">
      <header className="px-4 sm:px-8 py-4 sm:py-6 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="font-pixel text-xs sm:text-sm tracking-tight"
        >
          ← RATE MY GITHUB
        </Link>
        <ShareCardButton
          login={u.login}
          score={u.score}
          tier={u.tier}
          rank={u.rank}
          roast={u.roasts[0]?.body}
        />
      </header>

      <section
        className="border-y-2 border-arcade-ink dark:border-arcade-cream"
        style={{ backgroundColor: tierDef.color }}
      >
        <div className="mx-auto max-w-5xl px-4 sm:px-8 py-6 sm:py-10 grid lg:grid-cols-[auto_1fr_auto] gap-5 sm:gap-8 items-center">
          <div className="flex items-center gap-4 sm:gap-5">
            <Avatar
              src={u.avatar}
              size={96}
              border="lg"
              priority
              className="w-16 h-16 sm:w-24 sm:h-24"
            />
            <div className="text-arcade-ink min-w-0 flex-1">
              <p className="font-pixel text-[9px] sm:text-[10px] uppercase opacity-80">
                #{u.rank} — Top {u.percentile.toFixed(1)}%
              </p>
              <a
                href={`https://github.com/${u.login}`}
                target="_blank"
                rel="noreferrer"
                className="font-pixel text-base sm:text-xl md:text-2xl block mt-1 hover:underline underline-offset-4 truncate"
              >
                {u.login}
              </a>
              <p className="text-xs sm:text-sm opacity-80 mt-1 truncate">
                {u.name}
              </p>
              {u.bio && (
                <p className="hidden sm:block text-xs opacity-80 mt-2 max-w-sm">
                  {u.bio}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 lg:contents">
            <div className="flex lg:flex-col items-center gap-3 lg:gap-1 text-arcade-ink">
              <TierMedal
                tier={u.tier}
                size={64}
                className="sm:!w-20 sm:!h-20 lg:!w-[112px] lg:!h-[112px]"
                animate
              />
              <div className="lg:text-center">
                <p className="font-pixel text-[10px] sm:text-xs uppercase">
                  {tierDef.name}
                </p>
                <p className="font-pixel text-[9px] uppercase opacity-70 hidden sm:block">
                  {tierDef.tagline}
                </p>
              </div>
            </div>

            <div className="text-arcade-ink text-right lg:text-right">
              <p className="font-pixel text-[9px] sm:text-[10px] uppercase tracking-widest">
                Overall
              </p>
              <ScoreCounter
                value={u.score}
                className="block text-5xl sm:text-6xl md:text-7xl lg:text-8xl leading-none text-arcade-ink"
              />
              <p className="font-pixel text-[9px] sm:text-[10px] uppercase mt-1 opacity-80">
                / 100
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-5xl px-4 sm:px-8 py-8 sm:py-12 space-y-10 sm:space-y-14">
        <Block title="01 · Roasts">
          <RoastTags roasts={u.roasts} />
        </Block>

        <Block title="02 · Category breakdown">
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-10">
            <div className="pixel-border bg-arcade-cream-soft dark:bg-arcade-dark-soft p-3 sm:p-4">
              <CategoryRadar scores={u.categoryScores} />
            </div>
            <div className="pixel-border bg-arcade-cream-soft dark:bg-arcade-dark-soft p-4 sm:p-5">
              <CategoryBars scores={u.categoryScores} />
            </div>
          </div>
        </Block>

        <Block title="03 · Stats">
          <div className="grid lg:grid-cols-[2fr_1fr] gap-5 sm:gap-10">
            <CommitHeatmap weeks={u.heatmap} windowDays={u.heatmapWindowDays} />
            <div className="pixel-border bg-arcade-cream-soft dark:bg-arcade-dark-soft p-4">
              <p className="font-pixel text-[10px] uppercase opacity-80 mb-3">
                Language distribution
              </p>
              <LanguageDonut slices={u.languages} />
            </div>
          </div>
        </Block>

        <Block title="04 · Numbers">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <Stat label="Owned repos" sub="non-fork" value={u.totalRepos.toLocaleString()} />
            <Stat
              label="Commits"
              sub="last 12 months"
              value={u.totalCommits.toLocaleString()}
            />
            <Stat label="Followers" value={u.followers.toLocaleString()} />
            <Stat
              label="Joined GitHub"
              value={new Date(u.joined).toLocaleDateString("en-US", {
                month: "short",
                year: "numeric",
              })}
            />
          </div>
        </Block>

        <Block title="05 · Top repos">
          <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
            {u.repos.map((r) => (
              <RepoCard key={r.name} repo={r} login={u.login} />
            ))}
          </div>
        </Block>

        <Block title="06 · Timeline">
          <Timeline entries={u.timeline} />
        </Block>

        <Block title="07 · Compare">
          <CompareWidget self={u.categoryScores} selfLogin={u.login} />
        </Block>

        <Block title="08 · Rubric">
          <RubricFooter
            scores={u.categoryScores}
            reasoning={u.categoryReasoning}
            overallScore={u.score}
            login={u.login}
          />
        </Block>

        <footer className="pt-8 border-t-2 border-arcade-ink/20 dark:border-arcade-cream/20 flex flex-wrap justify-between font-pixel text-[9px] uppercase opacity-70">
          <span>rated {new Date(u.ratedAt).toLocaleString()}</span>
          <span>rubric v2 · all-time leaderboard</span>
        </footer>
      </main>
    </div>
  );
}

function Block({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-pixel text-[10px] uppercase tracking-widest text-arcade-red mb-5">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="pixel-border bg-arcade-cream-soft dark:bg-arcade-dark-soft p-3 sm:p-4">
      <p className="font-pixel text-[9px] uppercase opacity-70">{label}</p>
      {sub && (
        <p className="font-pixel text-[8px] uppercase opacity-50 mt-0.5">
          {sub}
        </p>
      )}
      <p className="font-score text-3xl sm:text-4xl tabular-nums mt-1 break-words">
        {value}
      </p>
    </div>
  );
}
