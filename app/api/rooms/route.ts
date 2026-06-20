import { NextResponse } from "next/server";
import { createRoom } from "@/lib/rooms";

export const dynamic = "force-dynamic";

// POST /api/rooms — create a new room, returns its code.
export async function POST() {
  const code = await createRoom();
  return NextResponse.json({ code });
}
