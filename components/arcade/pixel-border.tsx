import * as React from "react";
import { cn } from "@/lib/utils";

type Props = React.HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg";
  as?: React.ElementType;
};

export function PixelBorder({
  size = "md",
  className,
  as: Tag = "div",
  ...rest
}: Props) {
  const classNameForSize =
    size === "lg"
      ? "pixel-border-lg"
      : size === "sm"
        ? "pixel-border-sm"
        : "pixel-border";
  return <Tag className={cn(classNameForSize, className)} {...rest} />;
}
