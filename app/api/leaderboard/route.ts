import { NextRequest, NextResponse } from "next/server";
import { getRecentRatings, getTopRatings } from "@/lib/db/queries";

export const runtime = "nodejs";
export const revalidate = 30;

export async function GET(req: NextRequest) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "top";
  try {
    if (kind === "recent") {
      const rows = await getRecentRatings(20);
      return NextResponse.json({ rows });
    }
    if (kind === "shame") {
      // Hall of shame = bottom 6 by score. Reuse top query but slice from the end.
      const all = await getTopRatings(500);
      return NextResponse.json({ rows: all.slice(-6).reverse() });
    }
    const rows = await getTopRatings(100);
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, rows: [] },
      { status: 500 },
    );
  }
}
