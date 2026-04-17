"use client";

import { cn } from "@/lib/utils";

type Props = {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  id?: string;
};

export function EmailInput({ value, onChange, className, id }: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <label
        htmlFor={id}
        className="block font-pixel text-[9px] uppercase tracking-widest opacity-80"
      >
        Email — optional · we&apos;ll tell you if you hit #1
      </label>
      <input
        id={id}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="you@wherever.dev"
        className="w-full pixel-border-sm bg-arcade-cream dark:bg-arcade-dark-soft px-3 py-2 font-sans text-sm text-arcade-ink dark:text-arcade-cream placeholder:opacity-40 outline-none focus:outline-2 focus:outline-arcade-red focus:outline-offset-2"
      />
    </div>
  );
}
