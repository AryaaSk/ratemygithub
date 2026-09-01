export const REFERRAL_COOKIE_NAME = "rmg_ref_visit";
export const REFERRAL_TTL_SECONDS = 30 * 24 * 60 * 60;

const REFERRAL_ID_RE = /^[a-z0-9][a-z0-9._~-]{0,79}$/;

/** Normalize user-authored campaign IDs into a stable URL-safe key. */
export function normalizeReferralId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return REFERRAL_ID_RE.test(normalized) ? normalized : null;
}

/** Keep analytics paths same-origin and free of query-string data. */
export function normalizeLandingPath(value: unknown): string {
  if (typeof value !== "string") return "/";
  const path = value.trim().split(/[?#]/, 1)[0] ?? "/";
  if (!path.startsWith("/") || path.length > 200) return "/";
  return path || "/";
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}
