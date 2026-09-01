export type RankingProvider = "anthropic" | "openai";
export type AgentMode = "auto" | "mock" | "real";

export function resolveRankingProvider(value: string | undefined): RankingProvider {
  const normalized = value?.trim().toLowerCase() || "anthropic";
  if (normalized === "anthropic" || normalized === "openai") {
    return normalized;
  }
  throw new Error(
    `Invalid RANKING_PROVIDER=${JSON.stringify(value)}. Expected "anthropic" or "openai".`,
  );
}

export function resolveAgentMode(value: string | undefined): AgentMode {
  const normalized = value?.trim().toLowerCase() || "auto";
  if (normalized === "auto" || normalized === "mock" || normalized === "real") {
    return normalized;
  }
  throw new Error(
    `Invalid AGENT_MODE=${JSON.stringify(value)}. Expected "auto", "mock", or "real".`,
  );
}

export function providerHasApiKey(
  provider: RankingProvider,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return Boolean(
    provider === "openai" ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY,
  );
}

export function shouldUseMock(
  mode: AgentMode,
  provider: RankingProvider,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return mode === "mock" || (mode === "auto" && !providerHasApiKey(provider, env));
}

export function requiredApiKeyName(provider: RankingProvider): string {
  return provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
}
