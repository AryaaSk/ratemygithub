import "server-only";

/**
 * v2: no queue. Scoring runs synchronously inside /api/rate on a Vercel
 * function (60s cap on Pro). The old QStash + /api/worker indirection was
 * unnecessary since every rating fits in one function invocation.
 *
 * This file is kept as a placeholder for code that still imports it. Will
 * be removed once callers are fully cleaned up.
 */
export async function publishRatingJob(_: {
  jobId: string;
  login: string;
  appUrl: string;
}) {
  // no-op
}
