import { AliaskitLogo } from "./aliaskit-logo";

/**
 * Deliberately non-arcade. Black card, white type, soft rounded corners.
 * Slotted into the roasts grid as the final tile so it visually breaks
 * the wall of pixel-bordered flavor boxes.
 */
export function BuiltWithAliaskitCard() {
  return (
    <a
      href="https://aliaskit.com"
      target="_blank"
      rel="noreferrer"
      className="group relative overflow-hidden rounded-xl bg-[#0a0a0a] text-[#EDEDED] p-5 shadow-[0_8px_24px_-8px_rgba(10,10,10,0.35)] ring-1 ring-white/10 hover:ring-white/25 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-8px_rgba(10,10,10,0.45)] transition-all"
    >
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-lg bg-white/5 ring-1 ring-white/10 p-1.5">
          <AliaskitLogo size={28} className="text-[#EDEDED]" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em] text-white/55">
            Built using
          </p>
          <p className="font-sans font-semibold text-base leading-tight">
            AliasKit
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

      <p className="mt-3 text-sm leading-relaxed text-white/75">
        Identity infrastructure for AI agents — real inboxes, phones, virtual
        cards, and JWTs your services can verify. Built in one API call.
      </p>

      <p className="mt-3 text-xs text-white/40 font-mono">aliaskit.com</p>
    </a>
  );
}
