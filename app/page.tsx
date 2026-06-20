"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/;

export default function Home() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createRoom() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", { method: "POST" });
      if (!res.ok) throw new Error();
      const { code } = (await res.json()) as { code: string };
      router.push(`/room/${code}`);
    } catch {
      setError("Couldn't start a room. Try again.");
      setCreating(false);
    }
  }

  function join(e: React.FormEvent) {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!CODE_RE.test(c)) {
      setError("Enter a valid 4-character room code.");
      return;
    }
    router.push(`/room/${c}`);
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="text-6xl">🎤</div>
          <h1 className="mt-3 bg-gradient-to-r from-fuchsia-400 to-cyan-300 bg-clip-text text-4xl font-black tracking-tight text-transparent">
            Karaoke Queue
          </h1>
          <p className="mt-2 text-sm text-white/60">
            Nominate songs, vote them up, and sing.
          </p>
        </div>

        <button
          onClick={createRoom}
          disabled={creating}
          className="w-full rounded-2xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-4 text-lg font-bold text-white shadow-lg shadow-fuchsia-500/25 transition active:scale-[0.98] disabled:opacity-60"
        >
          {creating ? "Starting…" : "Start a room"}
        </button>

        <div className="my-6 flex items-center gap-3 text-xs tracking-widest text-white/30 uppercase">
          <span className="h-px flex-1 bg-white/10" />
          or join one
          <span className="h-px flex-1 bg-white/10" />
        </div>

        <form onSubmit={join} className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
            inputMode="text"
            autoCapitalize="characters"
            autoComplete="off"
            maxLength={4}
            className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-center text-2xl font-bold tracking-[0.3em] uppercase placeholder:tracking-normal placeholder:text-white/25 focus:border-fuchsia-400/60 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-2xl border border-white/10 bg-white/5 px-6 font-semibold transition hover:bg-white/10 active:scale-[0.98]"
          >
            Join
          </button>
        </form>

        {error && (
          <p className="mt-4 text-center text-sm text-rose-400">{error}</p>
        )}
      </div>
    </main>
  );
}
