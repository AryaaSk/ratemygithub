"use client";

import { useState } from "react";
import { PixelButton } from "@/components/arcade/pixel-button";
import { UsernameInput, isValidGithubLogin } from "@/components/forms/username-input";
import { EmailInput } from "@/components/forms/email-input";
import { ConfirmModal } from "@/components/forms/confirm-modal";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function HeroCard() {
  const [login, setLogin] = useState("");
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);

  const loginOk = isValidGithubLogin(login);
  const emailOk = email === "" || EMAIL_RE.test(email);
  const canSubmit = loginOk && emailOk;

  return (
    <div className="pixel-border-lg bg-arcade-red text-arcade-cream p-8 sm:p-10">
      <p className="font-pixel text-[10px] uppercase tracking-widest opacity-90">
        Insert coin to play
      </p>
      <h1 className="font-pixel text-2xl sm:text-3xl mt-3 leading-tight">
        Rate any public GitHub profile.
      </h1>
      <p className="mt-3 text-sm sm:text-base max-w-xl opacity-90">
        A sandboxed Claude agent scrapes the profile, scores it across 8
        categories, and drops you on the permanent leaderboard. One rating per
        account per day.
      </p>

      <form
        className="mt-6 grid gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (canSubmit) setConfirming(true);
        }}
      >
        <div className="bg-arcade-cream text-arcade-ink dark:bg-arcade-dark-soft dark:text-arcade-cream pixel-border p-5 space-y-5">
          <UsernameInput
            id="login"
            value={login}
            onChange={setLogin}
          />
          <EmailInput id="email" value={email} onChange={setEmail} />
          {email && !emailOk && (
            <p className="font-pixel text-[9px] uppercase text-arcade-red">
              Email looks off — double-check it or leave it blank.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-pixel text-[9px] uppercase opacity-90">
            Public data only. Nothing you couldn&apos;t see in a browser.
          </p>
          <PixelButton
            type="submit"
            size="lg"
            variant="secondary"
            disabled={!canSubmit}
          >
            Rate Me →
          </PixelButton>
        </div>
      </form>

      <ConfirmModal
        open={confirming}
        login={login}
        email={emailOk ? email : ""}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          // TODO (milestone 4): POST /api/rate
          setConfirming(false);
          alert(`[mock] Rating ${login}${email ? " · " + email : ""}`);
        }}
      />
    </div>
  );
}
