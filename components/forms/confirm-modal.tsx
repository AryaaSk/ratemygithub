"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { PixelButton } from "@/components/arcade/pixel-button";
import { Avatar } from "@/components/arcade/avatar";

type Props = {
  open: boolean;
  login: string;
  email?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({
  open,
  login,
  email,
  onCancel,
  onConfirm,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onCancel, onConfirm]);

  if (!open || typeof window === "undefined") return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal
      className="fixed inset-0 z-[200] flex items-center justify-center bg-arcade-ink/60 p-4"
      onClick={onCancel}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="pixel-border-lg w-full max-w-md bg-arcade-cream dark:bg-arcade-dark-soft p-6 space-y-5"
      >
        <p className="font-pixel text-[10px] uppercase tracking-widest text-arcade-red">
          Ready?
        </p>
        <h2 className="font-pixel text-lg leading-snug">
          Rate github.com/{login}?
        </h2>

        <div className="flex items-center gap-4 p-3 pixel-border-sm bg-arcade-cream-soft dark:bg-arcade-dark">
          <Avatar src={`https://github.com/${login}.png`} size={56} />
          <div className="text-xs space-y-1">
            <p>Their public profile will be scraped and scored.</p>
            <p className="opacity-70">Results go on the permanent leaderboard.</p>
            {email && (
              <p className="opacity-70">We&apos;ll email {email} if they hit #1.</p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <PixelButton variant="ghost" onClick={onCancel}>
            Cancel
          </PixelButton>
          <PixelButton variant="primary" onClick={onConfirm}>
            Rate Me
          </PixelButton>
        </div>

        <p className="text-[10px] opacity-60">
          Press <span className="font-pixel">ENTER</span> to confirm or{" "}
          <span className="font-pixel">ESC</span> to cancel.
        </p>
      </div>
    </div>,
    document.body,
  );
}
