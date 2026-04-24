"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  size: number;
  className?: string;
  /** Border style — matches the three pixel-border variants. */
  border?: "sm" | "md" | "lg";
  priority?: boolean;
};

/**
 * Avatar with a pulsing skeleton shown while the image is loading so users
 * don't mistake the blank square for a clickable button.
 */
export function Avatar({
  src,
  alt = "",
  size,
  className,
  border = "sm",
  priority,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  const borderClass =
    border === "lg"
      ? "pixel-border-lg"
      : border === "md"
        ? "pixel-border"
        : "pixel-border-sm";

  return (
    <span
      className={cn(
        "relative inline-block overflow-hidden bg-arcade-cream dark:bg-arcade-dark-soft shrink-0",
        borderClass,
        className,
      )}
      style={{ width: size, height: size }}
    >
      {!loaded && !errored && (
        <span
          aria-hidden
          className="absolute inset-0 animate-pulse bg-[linear-gradient(110deg,rgba(0,0,0,0.06)_20%,rgba(0,0,0,0.14)_40%,rgba(0,0,0,0.06)_60%)] dark:bg-[linear-gradient(110deg,rgba(255,255,255,0.06)_20%,rgba(255,255,255,0.14)_40%,rgba(255,255,255,0.06)_60%)]"
        />
      )}
      {!errored && (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          unoptimized
          priority={priority}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "w-full h-full object-cover transition-opacity duration-300",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
