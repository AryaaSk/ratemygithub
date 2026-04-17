"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-arcade-red text-arcade-cream hover:bg-arcade-red-deep active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  secondary:
    "bg-arcade-blue text-arcade-cream hover:bg-arcade-blue-deep active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
  ghost:
    "bg-transparent text-arcade-ink hover:bg-arcade-ink hover:text-arcade-cream dark:text-arcade-cream dark:hover:bg-arcade-cream dark:hover:text-arcade-ink active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
};

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
};

export const PixelButton = React.forwardRef<HTMLButtonElement, Props>(
  ({ className, variant = "primary", size = "md", children, ...rest }, ref) => {
    const sizeClasses =
      size === "lg"
        ? "px-6 py-4 text-sm pixel-border-lg"
        : size === "sm"
          ? "px-3 py-1.5 text-[10px] pixel-border-sm"
          : "px-4 py-2 text-xs pixel-border";
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 font-pixel uppercase tracking-wider transition-transform disabled:cursor-not-allowed disabled:opacity-50 disabled:active:translate-x-0 disabled:active:translate-y-0",
          sizeClasses,
          variantClasses[variant],
          className,
        )}
        {...rest}
      >
        {children}
      </button>
    );
  },
);
PixelButton.displayName = "PixelButton";
