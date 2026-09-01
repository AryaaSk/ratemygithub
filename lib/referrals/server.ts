import "server-only";

import { randomBytes } from "node:crypto";
import { and, eq, gte } from "drizzle-orm";
import { db, schema } from "@/lib/db/client";
import {
  REFERRAL_TTL_SECONDS,
  isUuid,
  normalizeLandingPath,
  normalizeReferralId,
} from "./shared";

export async function registerReferralVisit(input: {
  referralId: unknown;
  landingPath: unknown;
}) {
  const referralId = normalizeReferralId(input.referralId);
  if (!referralId) return null;
  const landingPath = normalizeLandingPath(input.landingPath);

  return db().transaction(async (tx) => {
    await tx
      .insert(schema.referrals)
      .values({ id: referralId, sourceType: "manual" })
      .onConflictDoNothing({ target: schema.referrals.id });

    const [visit] = await tx
      .insert(schema.referralVisits)
      .values({ referralId, landingPath })
      .returning({ id: schema.referralVisits.id });
    return { visitId: visit.id, referralId };
  });
}

export async function createShareReferral(sourceRatingId: unknown) {
  if (!isUuid(sourceRatingId)) return null;
  const [rating] = await db()
    .select({ id: schema.ratings.id })
    .from(schema.ratings)
    .where(eq(schema.ratings.id, sourceRatingId))
    .limit(1);
  if (!rating) return null;

  for (let attempt = 0; attempt < 3; attempt++) {
    const referralId = `x_${randomBytes(12).toString("base64url").toLowerCase()}`;
    const rows = await db()
      .insert(schema.referrals)
      .values({
        id: referralId,
        sourceType: "x_share",
        sourceRatingId: rating.id,
      })
      .onConflictDoNothing({ target: schema.referrals.id })
      .returning({ id: schema.referrals.id });
    if (rows[0]) return { referralId: rows[0].id };
  }
  throw new Error("Could not allocate a unique referral ID.");
}

export async function resolveActiveReferralVisit(value: unknown) {
  if (!isUuid(value)) return null;
  const cutoff = new Date(Date.now() - REFERRAL_TTL_SECONDS * 1000);
  const [visit] = await db()
    .select({ id: schema.referralVisits.id })
    .from(schema.referralVisits)
    .where(
      and(
        eq(schema.referralVisits.id, value),
        gte(schema.referralVisits.createdAt, cutoff),
      ),
    )
    .limit(1);
  return visit?.id ?? null;
}
