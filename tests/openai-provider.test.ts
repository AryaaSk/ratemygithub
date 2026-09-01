import assert from "node:assert/strict";
import test from "node:test";
import { ScriptedModel, functionCall } from "@openai/agents/testing";
import {
  OpenAIRankingProvider,
  estimateOpenAICost,
} from "../lib/agent/openai-provider";

const validRepoScore = {
  impact: 40,
  quality: 60,
  depth: 50,
  overallRepoScore: 51,
  summary: "A typed application with clear modules and documentation.",
  impactEvidence: ["40 stars on the repository", "README names the shipped product"],
  qualityEvidence: ["src/index.ts is typed", "README.md documents setup"],
  depthEvidence: ["30 recent commits sampled", "src/ contains multiple modules"],
};

test("OpenAI repository grader stops on its validated submission tool", async (t) => {
  const model = new ScriptedModel([
    [
      functionCall("submit_repo_score", validRepoScore, {
        callId: "repo_score_1",
      }),
    ],
  ]);
  t.after(() => model.assertComplete());

  const provider = new OpenAIRankingProvider({
    models: { pass2: model },
    tracingDisabled: true,
  });
  const result = await provider.scoreRepo("Score this synthetic repository.");

  assert.deepEqual(result, validRepoScore);
  assert.equal(model.calls.length, 1);
  assert.equal(model.firstCall?.request.modelSettings.toolChoice, "submit_repo_score");
});

test("OpenAI repository grader rejects malformed tool arguments", async () => {
  const model = new ScriptedModel([
    [
      functionCall(
        "submit_repo_score",
        { ...validRepoScore, quality: 120 },
        { callId: "repo_score_bad" },
      ),
    ],
  ]);
  const provider = new OpenAIRankingProvider({
    models: { pass2: model },
    tracingDisabled: true,
  });

  await assert.rejects(
    provider.scoreRepo("Score malformed output."),
    /validation|invalid_type|expected object|maximum|100/i,
  );
});

test("OpenAI cost estimate accounts for cached and long-context tokens", () => {
  const normal = estimateOpenAICost("gpt-5.6-luna", {
    input: 100_000,
    output: 5_000,
    cachedInput: 50_000,
    cacheWrite: 0,
    calls: 1,
  });
  assert.equal(Number(normal.toFixed(4)), 0.017);

  const long = estimateOpenAICost("gpt-5.6-terra", {
    input: 300_000,
    output: 10_000,
    cachedInput: 0,
    cacheWrite: 0,
    calls: 1,
  });
  assert.equal(Number(long.toFixed(2)), 1.38);
});
