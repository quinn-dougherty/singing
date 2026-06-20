import { NextRequest, NextResponse } from "next/server";
import { castVote, isValidCode } from "@/lib/rooms";
import type { VoteDir } from "@/lib/types";

export const dynamic = "force-dynamic";

// POST /api/rooms/[code]/songs/[id]/vote — set this viewer's vote.
// body: { clientId, dir: -1 | 0 | 1 }   (0 clears the vote)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string; id: string }> },
) {
  const { code: rawCode, id } = await params;
  const code = rawCode.toUpperCase();
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  let body: { clientId?: string; dir?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const clientId = body.clientId?.trim();
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }
  if (body.dir !== -1 && body.dir !== 0 && body.dir !== 1) {
    return NextResponse.json({ error: "Invalid vote" }, { status: 400 });
  }

  const ok = await castVote(code, id, clientId, body.dir as VoteDir);
  if (!ok) {
    return NextResponse.json({ error: "Song not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
