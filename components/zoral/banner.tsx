import Link from "next/link";

/**
 * Persistent top banner — part of the Zoral marketing wrap. Visually distinct
 * from the main UI (dark bar, small caps) so it reads as sponsor chrome
 * rather than app content.
 */
export function ZoralBanner() {
  return (
    <div className="w-full bg-arcade-ink text-arcade-cream border-b-2 border-arcade-ink dark:border-arcade-cream">
      <div className="mx-auto max-w-5xl px-4 py-1.5 flex items-center justify-between gap-3 text-[9px] sm:text-[10px] font-pixel uppercase tracking-widest">
        <span className="opacity-90">
          ▸ This tool was built by an AI agent from{" "}
          <Link
            href="https://zoral.ai"
            target="_blank"
            rel="noreferrer"
            className="text-arcade-green hover:underline underline-offset-2"
          >
            Zoral
          </Link>
        </span>
        <Link
          href="https://zoral.ai"
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline text-arcade-green hover:underline underline-offset-2"
        >
          Replace any worker with AI →
        </Link>
      </div>
    </div>
  );
}
