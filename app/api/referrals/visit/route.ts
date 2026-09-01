import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { registerReferralVisit } from "@/lib/referrals/server";
import {
  REFERRAL_COOKIE_NAME,
  REFERRAL_TTL_SECONDS,
} from "@/lib/referrals/shared";

export const runtime = "nodejs";

const BodySchema = z.object({
  ref: z.string().max(200),
  path: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid referral." }, { status: 400 });
  }

  try {
    const visit = await registerReferralVisit({
      referralId: parsed.data.ref,
      landingPath: parsed.data.path,
    });
    if (!visit) {
      return NextResponse.json({ error: "Invalid referral." }, { status: 400 });
    }

    const response = NextResponse.json({ visitId: visit.visitId });
    response.headers.set("cache-control", "no-store");
    response.cookies.set(REFERRAL_COOKIE_NAME, visit.visitId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFERRAL_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    console.warn(
      `[rmg] referral visit capture failed: ${(error as Error).message}`,
    );
    return NextResponse.json(
      { error: "Referral capture unavailable." },
      { status: 503 },
    );
  }
}
