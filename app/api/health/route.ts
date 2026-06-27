import { NextResponse } from "next/server";
import { getKv, kvBackend } from "@/lib/kv";

export const dynamic = "force-dynamic";

// GET /api/health — reports which KV backend the live deployment is using and
// whether a round-trip works. If `backend` is "memory" in production, rooms
// will not persist across requests (they live in one warm instance's RAM).
export async function GET() {
  const backend = kvBackend();
  const probe = `health:${backend}`;
  let roundTrip = false;
  let error: string | null = null;
  try {
    const kv = getKv();
    await kv.set(probe, "ok", { ex: 30 });
    roundTrip = (await kv.get(probe)) === "ok";
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  const ok = backend === "upstash" && roundTrip;
  return NextResponse.json({ ok, backend, roundTrip, error }, { status: ok ? 200 : 503 });
}
