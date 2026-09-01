import assert from "node:assert/strict";
import test from "node:test";
import {
  REFERRAL_TTL_SECONDS,
  isUuid,
  normalizeLandingPath,
  normalizeReferralId,
} from "../lib/referrals/shared";

test("normalizes safe referral IDs for stable campaign attribution", () => {
  assert.equal(normalizeReferralId("  X_Post-123  "), "x_post-123");
  assert.equal(normalizeReferralId("campaign.v2~test"), "campaign.v2~test");
  assert.equal(normalizeReferralId(""), null);
  assert.equal(normalizeReferralId("contains spaces"), null);
  assert.equal(normalizeReferralId("x".repeat(81)), null);
  assert.equal(normalizeReferralId({}), null);
});

test("keeps only a bounded same-origin landing path", () => {
  assert.equal(normalizeLandingPath("/u/octocat?ref=test#score"), "/u/octocat");
  assert.equal(normalizeLandingPath("/"), "/");
  assert.equal(normalizeLandingPath("https://evil.example/path"), "/");
  assert.equal(normalizeLandingPath("/" + "x".repeat(250)), "/");
});

test("uses a 30-day attribution window and strict visit UUIDs", () => {
  assert.equal(REFERRAL_TTL_SECONDS, 2_592_000);
  assert.equal(isUuid("2d1cbe0c-3a9a-4bb2-8656-855c594ea737"), true);
  assert.equal(isUuid("not-a-visit"), false);
});
