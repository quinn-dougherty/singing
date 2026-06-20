import { NextRequest, NextResponse } from "next/server";
import { addSong, isValidCode, roomExists } from "@/lib/rooms";

export const dynamic = "force-dynamic";

// POST /api/rooms/[code]/songs — nominate a song.
// body: { title, artist?, clientId, name }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = (await params).code.toUpperCase();
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }

  let body: {
    title?: string;
    artist?: string;
    clientId?: string;
    name?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const title = body.title?.trim();
  const clientId = body.clientId?.trim();
  const name = body.name?.trim() || "anon";
  if (!title) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "Missing clientId" }, { status: 400 });
  }
  if (!(await roomExists(code))) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  const result = await addSong(code, {
    title,
    artist: body.artist?.trim() || null,
    clientId,
    name,
  });
  return NextResponse.json({ ok: true, ...result });
}
