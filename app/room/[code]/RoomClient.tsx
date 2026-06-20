"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useIdentity } from "@/lib/identity";
import { songSearchUrl } from "@/lib/song";
import type { RoomState, SongView, VoteDir } from "@/lib/types";

const POLL_MS = 2000;

export default function RoomClient({ code }: { code: string }) {
  const { clientId, name, setName, ready } = useIdentity();
  const [room, setRoom] = useState<RoomState | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [showSung, setShowSung] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchRoom = useCallback(async () => {
    if (!clientId) return;
    try {
      const res = await fetch(`/api/rooms/${code}?clientId=${clientId}`, {
        cache: "no-store",
      });
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (!res.ok) return;
      setRoom((await res.json()) as RoomState);
      setNotFound(false);
    } catch {
      /* transient network error — next poll retries */
    }
  }, [clientId, code]);

  // Poll while the tab is visible.
  useEffect(() => {
    if (!clientId) return;
    fetchRoom();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") fetchRoom();
    }, POLL_MS);
    const onVis = () => {
      if (document.visibilityState === "visible") fetchRoom();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [clientId, fetchRoom]);

  async function vote(id: string, dir: VoteDir) {
    if (!clientId || !room) return;
    const cur = [...room.queue, ...room.sung].find((s) => s.id === id);
    const next: VoteDir = cur && cur.myVote === dir ? 0 : dir;
    setRoom((r) => (r ? applyVote(r, id, next) : r));
    try {
      await fetch(`/api/rooms/${code}/songs/${id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientId, dir: next }),
      });
    } finally {
      fetchRoom();
    }
  }

  function openSong(s: SongView, markSung: boolean) {
    // Open synchronously inside the click so the popup isn't blocked.
    window.open(songSearchUrl(s.title, s.artist), "_blank", "noopener");
    if (markSung) {
      fetch(`/api/rooms/${code}/songs/${s.id}/sung`, { method: "POST" }).finally(
        fetchRoom,
      );
    }
  }

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Karaoke Queue", url });
        return;
      }
    } catch {
      /* user dismissed share sheet */
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  if (notFound) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="text-5xl">🤔</div>
        <h1 className="text-2xl font-bold">Room {code} not found</h1>
        <p className="text-white/60">It may have expired or never existed.</p>
        <Link
          href="/"
          className="mt-2 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 px-5 py-3 font-semibold"
        >
          Back home
        </Link>
      </main>
    );
  }

  const needsName = ready && !name;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-10 border-b border-white/10 bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
          <div>
            <div className="text-[0.65rem] tracking-[0.25em] text-white/40 uppercase">
              Room
            </div>
            <div className="font-mono text-2xl font-black tracking-[0.2em] text-fuchsia-300">
              {code}
            </div>
          </div>
          <button
            onClick={share}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold transition hover:bg-white/10 active:scale-95"
          >
            {copied ? "Copied ✓" : "Share"}
          </button>
        </div>
        <div className="mx-auto w-full max-w-md px-4 pb-2 text-xs text-white/50">
          Singing as{" "}
          <button
            onClick={() => setEditingName(true)}
            className="font-semibold text-white/80 underline decoration-dotted underline-offset-2"
          >
            {name || "…"}
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pt-4 pb-24">
        <AddSong
          code={code}
          clientId={clientId}
          name={name}
          onAdded={fetchRoom}
        />

        <div className="mt-6 mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-bold tracking-wide text-white/70 uppercase">
            Up next
          </h2>
          <span className="text-xs text-white/40">
            {room ? `${room.queue.length} queued` : ""}
          </span>
        </div>

        {!room ? (
          <p className="py-10 text-center text-white/40">Loading…</p>
        ) : room.queue.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-10 text-center text-white/40">
            No songs yet — nominate the first one. 🎶
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {room.queue.map((s, i) => (
              <SongCard
                key={s.id}
                song={s}
                rank={i + 1}
                onVote={vote}
                onSing={() => openSong(s, true)}
              />
            ))}
          </ul>
        )}

        {room && room.sung.length > 0 && (
          <div className="mt-8">
            <button
              onClick={() => setShowSung((v) => !v)}
              className="flex w-full items-center justify-between text-sm font-bold tracking-wide text-white/50 uppercase"
            >
              <span>Already sung ({room.sung.length})</span>
              <span className="text-white/30">{showSung ? "▲" : "▼"}</span>
            </button>
            {showSung && (
              <ul className="mt-3 flex flex-col gap-1">
                {room.sung.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm text-white/60 line-through">
                        {s.title}
                      </div>
                      {s.artist && (
                        <div className="truncate text-xs text-white/30">
                          {s.artist}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => openSong(s, false)}
                      className="shrink-0 text-xs text-cyan-300/80 hover:text-cyan-200"
                    >
                      search ↗
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      {(needsName || editingName) && (
        <NameGate
          initial={name}
          forced={needsName}
          onSave={(n) => {
            setName(n);
            setEditingName(false);
          }}
          onCancel={() => setEditingName(false)}
        />
      )}
    </div>
  );
}

function SongCard({
  song,
  rank,
  onVote,
  onSing,
}: {
  song: SongView;
  rank: number;
  onVote: (id: string, dir: VoteDir) => void;
  onSing: () => void;
}) {
  return (
    <li className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-2.5">
      <div className="flex flex-col items-center">
        <button
          aria-label="Upvote"
          onClick={() => onVote(song.id, 1)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition active:scale-90 ${
            song.myVote === 1
              ? "bg-fuchsia-500 text-white"
              : "bg-white/5 text-white/50 hover:bg-white/10"
          }`}
        >
          ▲
        </button>
        <span
          className={`py-0.5 text-sm font-bold tabular-nums ${
            song.score > 0
              ? "text-fuchsia-300"
              : song.score < 0
                ? "text-cyan-300"
                : "text-white/50"
          }`}
        >
          {song.score}
        </span>
        <button
          aria-label="Downvote"
          onClick={() => onVote(song.id, -1)}
          className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition active:scale-90 ${
            song.myVote === -1
              ? "bg-cyan-500 text-white"
              : "bg-white/5 text-white/50 hover:bg-white/10"
          }`}
        >
          ▼
        </button>
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">
          <span className="mr-1.5 text-white/30 tabular-nums">{rank}.</span>
          {song.title}
        </div>
        {song.artist && (
          <div className="truncate text-sm text-white/50">{song.artist}</div>
        )}
        <div className="truncate text-xs text-white/30">
          by {song.nominatedBy}
        </div>
      </div>

      <button
        onClick={onSing}
        className="shrink-0 self-stretch rounded-xl bg-gradient-to-b from-fuchsia-500 to-pink-500 px-4 text-sm font-bold text-white shadow shadow-fuchsia-500/20 transition active:scale-95"
      >
        Sing ▶
      </button>
    </li>
  );
}

function AddSong({
  code,
  clientId,
  name,
  onAdded,
}: {
  code: string;
  clientId: string | null;
  name: string;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !clientId) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/rooms/${code}/songs`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, artist, clientId, name }),
      });
      if (res.ok) {
        const data = (await res.json()) as { merged?: boolean };
        setMsg(data.merged ? "Already on the list — bumped it 👍" : null);
        setTitle("");
        setArtist("");
        onAdded();
      } else {
        setMsg("Couldn't add that. Try again.");
      }
    } catch {
      setMsg("Network hiccup. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-white/10 bg-white/5 p-3"
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Song title"
        className="w-full rounded-xl bg-black/30 px-3 py-3 font-medium placeholder:text-white/30 focus:outline-none"
      />
      <input
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        placeholder="Artist (optional)"
        className="mt-2 w-full rounded-xl bg-black/30 px-3 py-3 text-sm placeholder:text-white/30 focus:outline-none"
      />
      <button
        type="submit"
        disabled={busy || !title.trim()}
        className="mt-2 w-full rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3 font-bold text-white transition active:scale-[0.99] disabled:opacity-40"
      >
        {busy ? "Adding…" : "Nominate"}
      </button>
      {msg && <p className="mt-2 text-center text-xs text-cyan-300/80">{msg}</p>}
    </form>
  );
}

function NameGate({
  initial,
  forced,
  onSave,
  onCancel,
}: {
  initial: string;
  forced: boolean;
  onSave: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initial);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (value.trim()) onSave(value.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#140f22] p-5 shadow-2xl"
      >
        <h2 className="text-lg font-bold">What&apos;s your name?</h2>
        <p className="mt-1 text-sm text-white/50">
          Shown next to the songs you nominate.
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g. Quinn"
          maxLength={24}
          className="mt-4 w-full rounded-xl bg-black/30 px-3 py-3 font-medium placeholder:text-white/30 focus:outline-none"
        />
        <div className="mt-4 flex gap-2">
          {!forced && (
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded-xl border border-white/10 py-3 font-semibold text-white/70"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={!value.trim()}
            className="flex-1 rounded-xl bg-gradient-to-r from-fuchsia-500 to-pink-500 py-3 font-bold text-white disabled:opacity-40"
          >
            {forced ? "Join room" : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Optimistically reflect a vote change before the server round-trip. */
function applyVote(room: RoomState, id: string, next: VoteDir): RoomState {
  const update = (s: SongView): SongView => {
    if (s.id !== id) return s;
    let { up, down } = s;
    if (s.myVote === 1) up--;
    else if (s.myVote === -1) down--;
    if (next === 1) up++;
    else if (next === -1) down++;
    return { ...s, up, down, score: up - down, myVote: next };
  };
  return {
    ...room,
    queue: room.queue.map(update),
    sung: room.sung.map(update),
  };
}
