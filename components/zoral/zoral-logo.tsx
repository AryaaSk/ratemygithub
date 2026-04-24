import { cn } from "@/lib/utils";

/**
 * Zoral mark. Simple rounded-square badge with a Z cut into it.
 * Uses `currentColor` so it inherits from the enclosing text color.
 */
export function ZoralLogo({
  size = 24,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={cn(className)}
      viewBox="0 0 48 48"
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      aria-hidden
    >
      <rect
        x="4"
        y="4"
        width="40"
        height="40"
        rx="9"
        fill="currentColor"
      />
      <path
        d="M15 16h18v3.2L20.2 32H33v3H15v-3.2L27.8 19H15z"
        fill="#0a0a0a"
      />
    </svg>
  );
}
