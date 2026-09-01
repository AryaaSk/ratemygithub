import assert from "node:assert/strict";
import test from "node:test";
import {
  providerHasApiKey,
  requiredApiKeyName,
  resolveAgentMode,
  resolveRankingProvider,
  shouldUseMock,
} from "../lib/agent/provider-selection";

test("ranking provider defaults to Anthropic for backwards compatibility", () => {
  assert.equal(resolveRankingProvider(undefined), "anthropic");
  assert.equal(resolveRankingProvider(" OPENAI "), "openai");
  assert.throws(() => resolveRankingProvider("fallback"), /Invalid RANKING_PROVIDER/);
});

test("agent mode validates supported modes", () => {
  assert.equal(resolveAgentMode(undefined), "auto");
  assert.equal(resolveAgentMode("REAL"), "real");
  assert.throws(() => resolveAgentMode("enabled"), /Invalid AGENT_MODE/);
});

test("mock fallback checks the selected provider's key", () => {
  const env = {
    NODE_ENV: "test",
    ANTHROPIC_API_KEY: "anthropic-test",
    OPENAI_API_KEY: "",
  } satisfies NodeJS.ProcessEnv;
  assert.equal(providerHasApiKey("anthropic", env), true);
  assert.equal(providerHasApiKey("openai", env), false);
  assert.equal(shouldUseMock("auto", "anthropic", env), false);
  assert.equal(shouldUseMock("auto", "openai", env), true);
  assert.equal(shouldUseMock("real", "openai", env), false);
  assert.equal(shouldUseMock("mock", "anthropic", env), true);
  assert.equal(requiredApiKeyName("openai"), "OPENAI_API_KEY");
});
