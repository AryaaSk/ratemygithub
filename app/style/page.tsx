import { PixelButton } from "@/components/arcade/pixel-button";
import { PixelBorder } from "@/components/arcade/pixel-border";
import { TierMedal } from "@/components/arcade/tier-medal";
import { ScoreCounter } from "@/components/arcade/score-counter";
import { CATEGORIES, TIERS } from "@/lib/scoring/rubric";

export const metadata = { title: "Style — RATE MY GITHUB" };

export default function StylePage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 space-y-16">
      <header>
        <p className="font-pixel text-[10px] uppercase tracking-widest text-arcade-red">
          Design system
        </p>
        <h1 className="font-pixel text-2xl mt-2">Rate My GitHub / Style</h1>
        <p className="mt-3 max-w-xl text-arcade-ink/80 dark:text-arcade-cream/80">
          Every arcade primitive on one page, to approve the look before wiring
          up real screens.
        </p>
      </header>

      {/* ------------------------------------------------------------------ */}
      <Section title="01 · Palette">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            ["cream", "bg-arcade-cream"],
            ["ink", "bg-arcade-ink"],
            ["red", "bg-arcade-red"],
            ["blue", "bg-arcade-blue"],
            ["green", "bg-arcade-green"],
            ["yellow", "bg-arcade-yellow"],
            ["purple", "bg-arcade-purple"],
            ["dark", "bg-arcade-dark"],
          ].map(([label, bg]) => (
            <PixelBorder key={label} className={`${bg} aspect-square flex items-end p-3`}>
              <span className="font-pixel text-[9px] uppercase text-arcade-cream mix-blend-difference">
                {label}
              </span>
            </PixelBorder>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="02 · Typography">
        <div className="space-y-4">
          <p className="font-pixel text-2xl">RATE MY GITHUB</p>
          <p className="font-pixel text-xs uppercase tracking-widest">
            Press Start 2P — headings / arcade wordmark
          </p>
          <p className="font-score text-5xl text-arcade-red">92.4</p>
          <p className="font-pixel text-[10px] uppercase tracking-widest">
            VT323 — scores, CRT digits
          </p>
          <p className="font-sans text-base">
            Geist Sans — body copy. Readable at paragraph length, distinct from
            the pixel font so long-form passages don&apos;t feel like you&apos;re
            decoding a ransom note.
          </p>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="03 · Tier medals">
        <div className="flex flex-wrap gap-6">
          {TIERS.map((t) => (
            <div key={t.tier} className="flex flex-col items-center gap-2">
              <TierMedal tier={t.tier} size={72} animate />
              <p className="font-pixel text-[10px]">{t.tier}</p>
              <p className="text-xs opacity-70">{t.name}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="04 · Score counter">
        <div className="flex flex-wrap items-end gap-10">
          <div className="flex flex-col items-center gap-2">
            <ScoreCounter value={92.4} className="text-7xl text-arcade-red" />
            <p className="font-pixel text-[10px]">Ascended — S</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ScoreCounter value={62.1} className="text-7xl text-arcade-blue" />
            <p className="font-pixel text-[10px]">Competent — C</p>
          </div>
          <div className="flex flex-col items-center gap-2">
            <ScoreCounter value={28.8} className="text-7xl text-arcade-ink/70 dark:text-arcade-cream/70" />
            <p className="font-pixel text-[10px]">Spectator — F</p>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="05 · Buttons">
        <div className="flex flex-wrap gap-4 items-center">
          <PixelButton variant="primary" size="lg">
            Insert Coin
          </PixelButton>
          <PixelButton variant="primary">Rate Me</PixelButton>
          <PixelButton variant="secondary">Share on X</PixelButton>
          <PixelButton variant="ghost">Cancel</PixelButton>
          <PixelButton variant="primary" size="sm">
            Small
          </PixelButton>
          <PixelButton variant="primary" disabled>
            Disabled
          </PixelButton>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="06 · Pixel cards">
        <div className="grid sm:grid-cols-2 gap-6">
          <PixelBorder className="bg-arcade-cream-soft dark:bg-arcade-dark-soft p-5 space-y-3">
            <p className="font-pixel text-[10px] uppercase text-arcade-red">
              Top repo
            </p>
            <p className="font-pixel text-sm">linux / linux</p>
            <p className="text-xs opacity-80">
              The Linux kernel. Yes, that one. Still actively maintained.
            </p>
            <div className="flex items-center gap-3">
              <span className="font-score text-2xl text-arcade-red">100</span>
              <span className="font-pixel text-[9px]">/ 100</span>
            </div>
          </PixelBorder>

          <PixelBorder className="bg-arcade-yellow p-5 space-y-2">
            <p className="font-pixel text-[10px] uppercase">Roast</p>
            <p className="font-pixel text-sm">README Overpromiser</p>
            <p className="text-xs">
              Promised &ldquo;distributed systems at scale&rdquo;. Backend is
              localStorage.
            </p>
          </PixelBorder>
        </div>
      </Section>

      {/* ------------------------------------------------------------------ */}
      <Section title="07 · Categories (rubric preview)">
        <ul className="space-y-2">
          {CATEGORIES.map((c) => (
            <li
              key={c.key}
              className="flex items-center justify-between gap-4 border-b border-arcade-ink/10 dark:border-arcade-cream/15 pb-2"
            >
              <div>
                <p className="font-pixel text-[11px] uppercase">{c.label}</p>
                <p className="text-xs opacity-70">{c.blurb}</p>
              </div>
              <span className="font-pixel text-[10px] text-arcade-red">
                {Math.round(c.weight * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </Section>
    </main>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="font-pixel text-xs uppercase tracking-widest mb-5 text-arcade-ink/80 dark:text-arcade-cream/80">
        {title}
      </h2>
      {children}
    </section>
  );
}
