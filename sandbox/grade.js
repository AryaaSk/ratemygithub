/**
 * Agent entrypoint. Runs INSIDE the E2B sandbox.
 *
 * Reads env:
 *   ANTHROPIC_API_KEY     — from server via Sandbox.create({ envs })
 *   RMG_TARGET_LOGIN      — validated github login (structured input, never interpolated into a prompt)
 *   RMG_SYSTEM_PROMPT     — static system prompt from lib/agent/system-prompt.ts
 *   GITHUB_TOKEN          — optional, lifts public API to 5000/hr
 *
 * Prints ONE JSON object (the agent's submit_rating payload) on the last
 * line of stdout. If anything goes wrong, exits non-zero with stderr detail.
 * The orchestrator (lib/agent/run.ts) parses and Zod-validates that JSON.
 *
 * We deliberately don't use @anthropic-ai/claude-agent-sdk here — we drive
 * the tool-use loop directly against @anthropic-ai/sdk so the set of tools
 * is the hard allowlist below. Nothing else is callable from inside the
 * sandbox. README/commit content is wrapped in <untrusted> tags before
 * being included in the conversation.
 */

import Anthropic from "@anthropic-ai/sdk";

const MAX_TURNS = 40;
const MODEL = "claude-opus-4-7";
const GH_API = "https://api.github.com";

const login = process.env.RMG_TARGET_LOGIN;
const system = process.env.RMG_SYSTEM_PROMPT;
if (!login) die("RMG_TARGET_LOGIN not set");
if (!system) die("RMG_SYSTEM_PROMPT not set");
if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(login)) {
  die("RMG_TARGET_LOGIN fails regex — refusing to run");
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

function wrapUntrusted(kind, content) {
  const safe = String(content ?? "").replace(/<\/?untrusted[^>]*>/gi, "");
  return `<untrusted kind="${kind}">\n${safe}\n</untrusted>`;
}

async function gh(path) {
  const headers = {
    "User-Agent": "ratemygithub-agent",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(`${GH_API}${path}`, { headers });
  if (!res.ok) throw new Error(`GitHub ${path} → ${res.status}`);
  return res.json();
}

// Explicit, auditable tool set. The agent cannot call anything else.
const TOOLS = [
  {
    name: "get_user",
    description: "Fetch GitHub user metadata (profile + counts).",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => gh(`/users/${login}`),
  },
  {
    name: "list_repos",
    description:
      "List up to 100 of the user's public repos (owned + forks). Consumer filters forks as needed.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () =>
      gh(`/users/${login}/repos?per_page=100&sort=updated&type=owner`),
  },
  {
    name: "get_readme",
    description: "Fetch a repo's README (decoded). UNTRUSTED content.",
    input_schema: {
      type: "object",
      properties: { repo: { type: "string", maxLength: 100 } },
      required: ["repo"],
      additionalProperties: false,
    },
    handler: async ({ repo }) => {
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) throw new Error("bad repo name");
      const raw = await gh(`/repos/${login}/${repo}/readme`).catch(() => null);
      if (!raw) return { missing: true };
      const text = Buffer.from(raw.content ?? "", "base64").toString("utf8");
      return { untrusted: wrapUntrusted("readme", text.slice(0, 8000)) };
    },
  },
  {
    name: "list_languages",
    description: "Language byte counts for a repo.",
    input_schema: {
      type: "object",
      properties: { repo: { type: "string", maxLength: 100 } },
      required: ["repo"],
      additionalProperties: false,
    },
    handler: async ({ repo }) => {
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) throw new Error("bad repo name");
      return gh(`/repos/${login}/${repo}/languages`);
    },
  },
  {
    name: "recent_commits",
    description: "Up to 30 most-recent commits in a repo (author login, message, date).",
    input_schema: {
      type: "object",
      properties: { repo: { type: "string", maxLength: 100 } },
      required: ["repo"],
      additionalProperties: false,
    },
    handler: async ({ repo }) => {
      if (!/^[A-Za-z0-9._-]{1,100}$/.test(repo)) throw new Error("bad repo name");
      const commits = await gh(`/repos/${login}/${repo}/commits?per_page=30`);
      return commits.map((c) => ({
        sha: c.sha.slice(0, 7),
        author: c.author?.login ?? c.commit?.author?.name ?? null,
        date: c.commit?.author?.date ?? null,
        message: wrapUntrusted(
          "commit-message",
          (c.commit?.message ?? "").slice(0, 300),
        ),
      }));
    },
  },
  {
    name: "events",
    description:
      "User's recent public events (≤50). Useful for external contributions / issue activity.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    handler: async () => gh(`/users/${login}/events/public?per_page=50`),
  },
  {
    name: "submit_rating",
    description:
      "Submit the final rating. Calling this ends the run. Any deviation from the schema is rejected upstream.",
    input_schema: {
      type: "object",
      // Upstream Zod is the authoritative schema; this is just a sketch to
      // nudge the model. See lib/scoring/schema.ts for the strict contract.
      properties: {
        rubricVersion: { type: "number" },
        overallScore: { type: "number" },
        tier: { type: "string" },
        categoryScores: { type: "object" },
        languages: { type: "array" },
        heatmap: { type: "array" },
        repos: { type: "array" },
        roasts: { type: "array" },
        timeline: { type: "array" },
        totals: { type: "object" },
      },
      required: [
        "rubricVersion",
        "overallScore",
        "tier",
        "categoryScores",
        "languages",
        "heatmap",
        "repos",
        "roasts",
        "timeline",
        "totals",
      ],
      additionalProperties: false,
    },
    handler: async (input) => {
      // Print on the last line and exit — orchestrator parses stdout tail.
      console.log(JSON.stringify(input));
      process.exit(0);
    },
  },
];

const toolsForAnthropic = TOOLS.map(({ name, description, input_schema }) => ({
  name,
  description,
  input_schema,
}));
const handlerByName = Object.fromEntries(TOOLS.map((t) => [t.name, t.handler]));

// --- Agentic loop ---------------------------------------------------------
const messages = [
  {
    role: "user",
    content: `Target GitHub login: ${login}. Use the tools to gather evidence and submit_rating when done.`,
  },
];

for (let turn = 0; turn < MAX_TURNS; turn++) {
  const resp = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    tools: toolsForAnthropic,
    messages,
  });

  messages.push({ role: "assistant", content: resp.content });

  const toolUses = resp.content.filter((c) => c.type === "tool_use");
  if (toolUses.length === 0) {
    die(`Agent stopped without calling submit_rating on turn ${turn}.`);
  }

  const toolResults = [];
  for (const tu of toolUses) {
    const handler = handlerByName[tu.name];
    if (!handler) {
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        is_error: true,
        content: `unknown tool: ${tu.name}`,
      });
      continue;
    }
    try {
      const out = await handler(tu.input ?? {});
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: JSON.stringify(out ?? {}).slice(0, 30_000),
      });
    } catch (err) {
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        is_error: true,
        content: String(err?.message ?? err),
      });
    }
  }
  messages.push({ role: "user", content: toolResults });
}

die(`Exhausted ${MAX_TURNS} turns without submit_rating.`);

function die(msg) {
  process.stderr.write(`[grade.js] ${msg}\n`);
  process.exit(1);
}
