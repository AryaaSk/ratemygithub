import "server-only";

const GITHUB_LOGIN_RE = /^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/;

export type ValidateResult =
  | {
      ok: true;
      user: {
        login: string;          // canonical casing from GitHub
        loginKey: string;       // lowercase, used as DB key
        avatarUrl: string | null;
        name: string | null;
        bio: string | null;
        /** Real GitHub join date (from /users/:login). */
        createdAt: string | null;
      };
    }
  | {
      ok: false;
      code: "malformed" | "not_found" | "not_a_user" | "rate_limited" | "network";
      message: string;
    };

/**
 * Three-layer validation of a GitHub username:
 *   1. regex (same rule GitHub uses server-side)
 *   2. live GET https://api.github.com/users/:login
 *   3. ensure type === "User" (rejects orgs, bots, and nonexistent accounts)
 *
 * This is the security perimeter — the value returned here is what the
 * background agent receives as a structured tool input. Never concatenate
 * the raw user-supplied string into an LLM prompt.
 */
export async function validateGithubLogin(input: string): Promise<ValidateResult> {
  const trimmed = input.trim();
  if (!GITHUB_LOGIN_RE.test(trimmed)) {
    return { ok: false, code: "malformed", message: "Invalid GitHub username format." };
  }

  const headers: Record<string, string> = {
    "User-Agent": "ratemygithub-validator",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/users/${encodeURIComponent(trimmed)}`, {
      headers,
      // Cache-bust — we specifically want live existence
      cache: "no-store",
    });
  } catch (err) {
    return {
      ok: false,
      code: "network",
      message: `Couldn't reach github.com — ${(err as Error).message}`,
    };
  }

  if (res.status === 404) {
    return { ok: false, code: "not_found", message: "No such GitHub user." };
  }
  if (res.status === 403 || res.status === 429) {
    return {
      ok: false,
      code: "rate_limited",
      message: "GitHub rate limit hit — try again in a minute.",
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      code: "network",
      message: `GitHub returned ${res.status}.`,
    };
  }

  const body = (await res.json()) as {
    login: string;
    type: string;
    avatar_url?: string;
    name?: string | null;
    bio?: string | null;
    created_at?: string;
  };

  if (body.type !== "User") {
    return {
      ok: false,
      code: "not_a_user",
      message: `${body.login} is a ${body.type}, not a user account.`,
    };
  }

  return {
    ok: true,
    user: {
      login: body.login,
      loginKey: body.login.toLowerCase(),
      avatarUrl: body.avatar_url ?? null,
      name: body.name ?? null,
      bio: body.bio ?? null,
      createdAt: body.created_at ?? null,
    },
  };
}
