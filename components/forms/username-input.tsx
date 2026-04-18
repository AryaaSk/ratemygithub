"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const GITHUB_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

type Props = {
  value: string;
  onChange: (v: string) => void;
  onValidChange?: (valid: boolean) => void;
  className?: string;
  id?: string;
};

export function UsernameInput({
  value,
  onChange,
  onValidChange,
  className,
  id,
}: Props) {
  const [touched, setTouched] = useState(false);
  const valid = value === "" ? null : GITHUB_LOGIN_RE.test(value);
  return (
    <div className={cn("space-y-2 min-w-0", className)}>
      <label
        htmlFor={id}
        className="block font-pixel text-[10px] uppercase tracking-widest"
      >
        GitHub username
      </label>
      <div className="flex items-stretch w-full min-w-0 pixel-border bg-arcade-cream dark:bg-arcade-dark-soft">
        <span
          aria-hidden
          className="flex items-center shrink-0 px-2 sm:px-3 font-pixel text-[9px] sm:text-[10px] uppercase opacity-70 border-r-2 border-arcade-ink dark:border-arcade-cream"
        >
          github.com/
        </span>
        <input
          id={id}
          value={value}
          onChange={(e) => {
            const v = e.target.value.trim();
            onChange(v);
            onValidChange?.(v !== "" && GITHUB_LOGIN_RE.test(v));
          }}
          onBlur={() => setTouched(true)}
          placeholder="octocat"
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          className="flex-1 min-w-0 w-full bg-transparent px-3 py-3 font-score text-lg sm:text-2xl text-arcade-ink dark:text-arcade-cream placeholder:opacity-40 outline-none"
          maxLength={39}
        />
      </div>
      {touched && valid === false && (
        <p className="font-pixel text-[9px] uppercase text-arcade-red">
          That&apos;s not a valid GitHub username.
        </p>
      )}
    </div>
  );
}

export function isValidGithubLogin(v: string) {
  return GITHUB_LOGIN_RE.test(v);
}
