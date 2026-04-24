import { ZoralLogo } from "./zoral-logo";

/**
 * Deliberately non-arcade. Pure black card with a purple-lavender gradient
 * echoing zoral.ai's hero. Slotted into the roasts grid as the final tile
 * so it visually breaks the wall of pixel-bordered flavor boxes.
 */
export function BuiltWithZoralCard() {
  return (
    <a
      href="https://zoral.ai"
      target="_blank"
      rel="noreferrer"
      className="group relative overflow-hidden rounded-xl bg-black text-white p-5 shadow-[0_10px_30px_-10px_rgba(10,10,10,0.5)] ring-1 ring-white/10 hover:ring-white/25 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_-12px_rgba(124,104,238,0.35)] transition-all"
    >
      {/* Subtle purple bloom anchored top-right, echoing the zoral.ai hero glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-10 w-48 h-48 rounded-full opacity-60 blur-3xl"
        style={{
          background:
            "radial-gradient(closest-side, rgba(167,139,250,0.45), rgba(167,139,250,0) 70%)",
        }}
      />

      <div className="relative flex items-center gap-3">
        <div className="shrink-0 rounded-lg bg-white/5 ring-1 ring-white/10 p-1.5">
          <ZoralLogo size={28} className="text-[#EDEDED]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Built using
          </p>
          <p className="font-sans font-semibold text-base leading-tight bg-gradient-to-r from-white via-[#d8cbff] to-[#a78bfa] bg-clip-text text-transparent">
            Zoral
          </p>
        </div>
        <div className="ml-auto text-white/40 group-hover:text-white transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M7 17L17 7M17 7H8M17 7V16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <p className="relative mt-3 text-sm leading-relaxed text-white/80">
        Shadows <span className="text-white">one worker</span> for a week, then
        takes over their job with{" "}
        <span className="text-[#a78bfa]">zero extra setup</span>. Behaves
        exactly like the original.
      </p>

      <p className="relative mt-3 text-xs text-white/40 font-mono">zoral.ai</p>
    </a>
  );
}
