import "server-only";

/**
 * Cloudflare Turnstile verification. Soft-disabled until env is configured
 * so local dev doesn't need a real token.
 */
export async function verifyTurnstile(token: string | null, remoteIp: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    // If Turnstile isn't configured, treat it as a pass but log a warning.
    return { ok: true, skipped: true as const };
  }
  if (!token) {
    return { ok: false, skipped: false as const, reason: "missing_token" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body, cache: "no-store" },
  );
  const json = (await res.json()) as { success: boolean; "error-codes"?: string[] };
  return {
    ok: json.success,
    skipped: false as const,
    reason: json["error-codes"]?.join(",") ?? null,
  };
}
