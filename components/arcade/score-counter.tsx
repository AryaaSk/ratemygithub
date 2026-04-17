"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  value: number;
  /** ms */
  duration?: number;
  className?: string;
  decimals?: 0 | 1;
  /** Start count from this value. Defaults to 0. */
  from?: number;
};

/**
 * SNES-style score counter — ticks up digit-by-digit on mount.
 * Uses requestAnimationFrame so it's smooth at any frame rate and
 * doesn't flood React state.
 */
export function ScoreCounter({
  value,
  duration = 1400,
  className,
  decimals = 1,
  from = 0,
}: Props) {
  const [display, setDisplay] = useState(from);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    startRef.current = null;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const elapsed = t - startRef.current;
      const progress = Math.min(1, elapsed / duration);
      // ease-out-quint: starts fast, slows near target
      const eased = 1 - Math.pow(1 - progress, 5);
      setDisplay(from + (value - from) * eased);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration, from]);

  return (
    <span
      className={cn("font-score tabular-nums", className)}
      aria-label={`Score ${value}`}
    >
      {display.toFixed(decimals)}
    </span>
  );
}
