import { NextRequest, NextResponse } from "next/server";
import { getRecentRatings, getTopRatings } from "@/lib/db/queries";

export const runtime = "nodejs";
export const revalidate = 30;

type RowLike = { login: string };

function dedupeByLogin<T extends RowLike>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = r.login.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

export async function GET(req: NextRequest) {
  const kind = new URL(req.url).searchParams.get("kind") ?? "top";
  try {
    if (kind === "recent") {
      const rows = await getRecentRatings(20);
      return NextResponse.json({ rows: dedupeByLogin(rows) });
    }
    if (kind === "shame") {
      // Hall of shame = bottom 6 unique logins by score.
      const all = await getTopRatings(500);
      const unique = dedupeByLogin(all);
      return NextResponse.json({ rows: unique.slice(-6).reverse() });
    }
    const rows = await getTopRatings(500);
    return NextResponse.json({ rows: dedupeByLogin(rows) });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message, rows: [] },
      { status: 500 },
    );
  }
}
