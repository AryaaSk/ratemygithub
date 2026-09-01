import { loadEnvConfig } from "@next/env";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const TEST_BUDGET_USD = 5;
const CONSERVATIVE_RUN_RESERVE_USD = 1.5;
const DEFAULT_LOGINS = ["EthanMendozaa", "aagra109", "steipete"];
const ledgerPath = path.join(process.cwd(), ".openai-calibration-spend.json");

type Ledger = { estimatedSpendUsd: number; runs: number };

async function readLedger(): Promise<Ledger> {
  try {
    const parsed = JSON.parse(await readFile(ledgerPath, "utf8")) as Partial<Ledger>;
    return {
      estimatedSpendUsd: Number(parsed.estimatedSpendUsd) || 0,
      runs: Number(parsed.runs) || 0,
    };
  } catch {
    return { estimatedSpendUsd: 0, runs: 0 };
  }
}

async function saveLedger(ledger: Ledger) {
  await writeFile(ledgerPath, `${JSON.stringify(ledger, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function main() {
  loadEnvConfig(process.cwd());
  process.env.RANKING_PROVIDER = "openai";
  process.env.AGENT_MODE = "real";

  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set in .env.local.");
  }

  const requested = process.argv.slice(2).filter((arg) => arg !== "--");
  const logins = requested.length > 0 ? requested : DEFAULT_LOGINS;
  if (logins.length > 3) {
    throw new Error("Calibration is capped at three profile identities per invocation.");
  }

  const [{ runAgent }, { getLatestRating }] = await Promise.all([
    import("../lib/agent/run"),
    import("../lib/db/queries"),
  ]);

  const ledger = await readLedger();
  const summaries: Array<Record<string, unknown>> = [];

  for (const login of logins) {
    if (
      ledger.estimatedSpendUsd + CONSERVATIVE_RUN_RESERVE_USD >
      TEST_BUDGET_USD
    ) {
      throw new Error(
        `Calibration budget guard stopped before ${login}: $${ledger.estimatedSpendUsd.toFixed(4)} already recorded.`,
      );
    }

    const baseline = await getLatestRating(login);
    const result = await runAgent(login.toLowerCase());
    const cost = result.diagnostics?.estimatedCostUsd ?? 0;
    ledger.estimatedSpendUsd += cost;
    ledger.runs += 1;
    await saveLedger(ledger);

    const categoryDelta = baseline
      ? Object.fromEntries(
          Object.entries(result.rating.categoryScores).map(([key, value]) => [
            key,
            Number(
              (
                value -
                Number(
                  (baseline.categoryScores as Record<string, number>)[key] ?? 0,
                )
              ).toFixed(1),
            ),
          ]),
        )
      : null;

    summaries.push({
      login,
      baseline: baseline
        ? { score: baseline.score, tier: baseline.tier }
        : null,
      openai: {
        score: result.rating.overallScore,
        tier: result.rating.tier,
      },
      overallDelta: baseline
        ? Number((result.rating.overallScore - baseline.score).toFixed(1))
        : null,
      categoryDelta,
      estimatedCostUsd: Number(cost.toFixed(4)),
    });
  }

  const comparable = summaries.filter(
    (summary) => summary.baseline !== null && summary.overallDelta !== null,
  );
  const absoluteCategoryDeltas = comparable
    .flatMap((summary) =>
      Object.values((summary.categoryDelta ?? {}) as Record<string, number>),
    )
    .map(Math.abs)
    .sort((a, b) => a - b);
  const midpoint = Math.floor(absoluteCategoryDeltas.length / 2);
  const medianCategoryError =
    absoluteCategoryDeltas.length === 0
      ? null
      : absoluteCategoryDeltas.length % 2 === 1
        ? absoluteCategoryDeltas[midpoint]
        : (absoluteCategoryDeltas[midpoint - 1] + absoluteCategoryDeltas[midpoint]) /
          2;
  const sameTier = comparable.every(
    (summary) =>
      (summary.baseline as { tier: string }).tier ===
      (summary.openai as { tier: string }).tier,
  );
  const maxOverallDelta = comparable.reduce(
    (max, summary) => Math.max(max, Math.abs(summary.overallDelta as number)),
    0,
  );
  const passed =
    comparable.length === logins.length &&
    sameTier &&
    maxOverallDelta <= 5 &&
    medianCategoryError !== null &&
    medianCategoryError <= 8;

  console.log(
    JSON.stringify(
      {
        budgetUsd: TEST_BUDGET_USD,
        cumulativeEstimatedSpendUsd: Number(ledger.estimatedSpendUsd.toFixed(4)),
        runs: ledger.runs,
        acceptance: {
          passed,
          sameTier,
          maxOverallDelta: Number(maxOverallDelta.toFixed(1)),
          medianCategoryError,
          thresholds: { maxOverallDelta: 5, medianCategoryError: 8 },
        },
        summaries,
      },
      null,
      2,
    ),
  );
  if (!passed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
