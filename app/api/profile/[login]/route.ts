import { NextRequest, NextResponse } from "next/server";
import { profileData } from "@/lib/data";

export const runtime = "nodejs";
export const revalidate = 30;

/**
 * Lightweight profile lookup — used by the compare widget to fetch an
 * existing rating without triggering a full re-rate. Returns 404 if the
 * user hasn't been rated yet.
 */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ login: string }> },
) {
  const { login } = await ctx.params;
  if (!/^[A-Za-z0-9](?:[A-Za-z0-9]|-(?=[A-Za-z0-9])){0,38}$/.test(login)) {
    return NextResponse.json({ error: "Invalid login format." }, { status: 400 });
  }
  const data = await profileData(login);
  if (!data) {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  return NextResponse.json({
    found: true,
    login: data.login,
    score: data.score,
    tier: data.tier,
    avatar: data.avatar,
    categoryScores: data.categoryScores,
  });
}
