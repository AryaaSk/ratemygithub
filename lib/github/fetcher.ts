import "server-only";

/**
 * Thin fetch wrapper around the GitHub REST API. Uses GITHUB_TOKEN when
 * present (5000/hr) — the two-pass scorer fires ~25 calls per profile so
 * a token is effectively required in production.
 */
const GH = "https://api.github.com";

function headers() {
  const h: Record<string, string> = {
    "User-Agent": "ratemygithub",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

async function gh<T>(path: string): Promise<T> {
  const res = await fetch(`${GH}${path}`, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status}`);
  return res.json() as Promise<T>;
}

export type GHUser = {
  login: string;
  avatar_url: string | null;
  name: string | null;
  bio: string | null;
  followers: number;
  following: number;
  public_repos: number;
  /** Real GitHub join date. Not to be confused with our DB row's createdAt. */
  created_at: string;
  type: string;
};

export type GHContributionCalendar = {
  totalContributions: number;
  weeks: Array<{
    contributionDays: Array<{ date: string; contributionCount: number }>;
  }>;
};

export type GHContributions = {
  /** Real calendar for the last 52 weeks. */
  calendar: GHContributionCalendar;
  totalCommitContributions: number;
  totalPullRequestContributions: number;
  totalIssueContributions: number;
  /** Repository language byte totals for the top repos the viewer owns. */
  languageBytes: Array<{ language: string; bytes: number }>;
  /** Join date again, sourced from GraphQL — always authoritative. */
  createdAt: string;
};

export type GHRepo = {
  name: string;
  full_name: string;
  description: string | null;
  fork: boolean;
  stargazers_count: number;
  forks_count: number;
  watchers_count: number;
  language: string | null;
  default_branch: string;
  pushed_at: string;
  created_at: string;
  size: number;
  license: { spdx_id: string | null } | null;
  has_issues: boolean;
};

export type GHEvent = {
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: {
    commits?: Array<{ message?: string; author?: { name?: string } }>;
    pull_request?: { html_url: string };
    action?: string;
  };
};

export type GHTreeItem = { path: string; type: "blob" | "tree"; size?: number };

export async function fetchUser(login: string) {
  return gh<GHUser>(`/users/${login}`);
}

export async function fetchRepos(login: string) {
  // 100 per page, sorted by pushed so active stuff comes first.
  return gh<GHRepo[]>(`/users/${login}/repos?per_page=100&sort=pushed&type=owner`);
}

export async function fetchEvents(login: string) {
  return gh<GHEvent[]>(`/users/${login}/events/public?per_page=100`);
}

export async function fetchRepoTree(login: string, repo: string, branch: string) {
  const data = await gh<{ tree: GHTreeItem[]; truncated?: boolean }>(
    `/repos/${login}/${repo}/git/trees/${branch}?recursive=1`,
  );
  return data.tree ?? [];
}

export async function fetchReadme(login: string, repo: string) {
  try {
    const res = await fetch(`${GH}/repos/${login}/${repo}/readme`, {
      headers: headers(),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: string; encoding?: string };
    if (body.encoding !== "base64" || !body.content) return null;
    return Buffer.from(body.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export async function fetchFile(login: string, repo: string, path: string, branch: string) {
  // The contents API returns base64-encoded blobs up to 1MB — plenty for our needs.
  // Using raw.githubusercontent.com is faster and doesn't consume rate limit.
  try {
    const res = await fetch(
      `https://raw.githubusercontent.com/${login}/${repo}/${branch}/${path}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

export async function fetchRepoCommits(login: string, repo: string) {
  // Up to 30 most recent commits — for night-owl index and recency stats.
  try {
    return await gh<Array<{ commit: { author?: { date: string } } }>>(
      `/repos/${login}/${repo}/commits?per_page=30`,
    );
  } catch {
    return [];
  }
}

/**
 * One GraphQL call that gives us:
 *   • the real 365-day contribution calendar (not 90 days of events)
 *   • real total commits / PRs / issues for the last year
 *   • language byte breakdowns across the user's top 30 owned non-fork repos
 *   • the actual GitHub join date
 *
 * Much richer than the REST endpoints we were cobbling together.
 */
export async function fetchContributions(login: string): Promise<GHContributions | null> {
  const query = `
    query($login: String!) {
      user(login: $login) {
        createdAt
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { date contributionCount }
            }
          }
          totalCommitContributions
          totalPullRequestContributions
          totalIssueContributions
        }
        repositories(
          first: 30
          isFork: false
          ownerAffiliations: [OWNER]
          orderBy: { field: STARGAZERS, direction: DESC }
        ) {
          nodes {
            name
            languages(first: 10, orderBy: { field: SIZE, direction: DESC }) {
              edges { size node { name } }
            }
          }
        }
      }
    }
  `;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: { ...headers(), "content-type": "application/json" },
      body: JSON.stringify({ query, variables: { login } }),
      cache: "no-store",
    });
    if (!res.ok) return null;
    type GqlShape = {
      data?: {
        user?: {
          createdAt: string;
          contributionsCollection: {
            contributionCalendar: GHContributionCalendar;
            totalCommitContributions: number;
            totalPullRequestContributions: number;
            totalIssueContributions: number;
          };
          repositories: {
            nodes: Array<{
              languages: {
                edges: Array<{ size: number; node: { name: string } }>;
              };
            }>;
          };
        } | null;
      };
      errors?: Array<{ message: string }>;
    };
    const body = (await res.json()) as GqlShape;
    if (!body.data?.user) return null;
    const u = body.data.user;

    // Sum language bytes across the top 30 repos.
    const byLang = new Map<string, number>();
    for (const r of u.repositories.nodes) {
      for (const e of r.languages.edges) {
        byLang.set(e.node.name, (byLang.get(e.node.name) ?? 0) + e.size);
      }
    }
    const languageBytes = Array.from(byLang.entries())
      .map(([language, bytes]) => ({ language, bytes }))
      .sort((a, b) => b.bytes - a.bytes);

    return {
      calendar: u.contributionsCollection.contributionCalendar,
      totalCommitContributions: u.contributionsCollection.totalCommitContributions,
      totalPullRequestContributions: u.contributionsCollection.totalPullRequestContributions,
      totalIssueContributions: u.contributionsCollection.totalIssueContributions,
      languageBytes,
      createdAt: u.createdAt,
    };
  } catch {
    return null;
  }
}
