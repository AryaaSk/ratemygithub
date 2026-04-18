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
    <div className={cn("flex items-center gap-2 min-w-0 w-full", className)}>
      <label
        htmlFor={id}
        className="font-pixel text-[8px] uppercase tracking-widest opacity-50 shrink-0"
      >
        optional email
      </label>
      <input
        id={id}
        type="email"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="for the #1 prize ping"
        className="flex-1 min-w-0 w-full bg-transparent border-b border-arcade-ink/20 dark:border-arcade-cream/20 px-0 py-1 font-sans text-xs text-arcade-ink dark:text-arcade-cream placeholder:opacity-40 outline-none focus:border-arcade-red"
      />
    </div>
  );
}
