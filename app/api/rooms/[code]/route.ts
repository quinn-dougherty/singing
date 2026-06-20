import { NextRequest, NextResponse } from "next/server";
import { getRoom, isValidCode } from "@/lib/rooms";

export const dynamic = "force-dynamic";

// GET /api/rooms/[code]?clientId=... — current room state for this viewer.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const code = (await params).code.toUpperCase();
  if (!isValidCode(code)) {
    return NextResponse.json({ error: "Invalid room code" }, { status: 400 });
  }
  const clientId = req.nextUrl.searchParams.get("clientId") ?? "";
  const room = await getRoom(code, clientId);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  return NextResponse.json(room);
}
