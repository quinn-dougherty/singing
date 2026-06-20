import { NextRequest, NextResponse } from "next/server";
import { isValidCode, markSung } from "@/lib/rooms";

export const dynamic = "force-dynamic";

// POST /api/rooms/[code]/songs/[id]/sung — move a song to the sung history.
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const { code: rawCode, id } = await params;
  const code = rawCode.toUpperCase();
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }
  const ok = await markSung(code, id);
  if (!ok) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
