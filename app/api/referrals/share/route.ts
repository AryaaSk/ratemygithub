import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createShareReferral } from "@/lib/referrals/server";

export const runtime = "nodejs";

const BodySchema = z.object({ ratingId: z.string().uuid() });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid rating ID." }, { status: 400 });
  }

  try {
    const referral = await createShareReferral(parsed.data.ratingId);
    if (!referral) {
      return NextResponse.json({ error: "Rating not found." }, { status: 404 });
    }
    return NextResponse.json(referral, {
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    console.warn(
      `[rmg] share referral creation failed: ${(error as Error).message}`,
    );
    return NextResponse.json(
      { error: "Could not create share link." },
      { status: 503 },
    );
  }
}
