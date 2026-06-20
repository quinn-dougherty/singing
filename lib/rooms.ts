// Room data operations on top of the KV store.

import { createHash, randomInt } from "node:crypto";
import { getKv } from "./kv";
import { normalizeText } from "./song";
import type { RoomState, SongView, StoredSong, VoteDir } from "./types";

const ROOM_TTL = 60 * 60 * 24; // 24h; refreshed on every read/write
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars
const CODE_LEN = 4;
const VOTE_SEP = "::";

const roomKey = (code: string) => `room:${code}`;
const songsKey = (code: string) => `songs:${code}`;
const votesKey = (code: string) => `votes:${code}`;
const sungKey = (code: string) => `sung:${code}`;

/** Deterministic id from title+artist so re-nominations collapse onto one song. */
function songId(title: string, artist: string | null): string {
  const key = `${normalizeText(title)}|${normalizeText(artist ?? "")}`;
  return createHash("sha1").update(key).digest("base64url").slice(0, 10);
}

function randomCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LEN; i++) {
    out += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  }
  return out;
}

/** True if `code` is a syntactically valid (already-normalized) room code. */
export function isValidCode(code: string): boolean {
  return (
    code.length === CODE_LEN &&
    [...code].every((c) => CODE_ALPHABET.includes(c))
  );
}

/** Refresh TTL on all of a room's keys so active rooms don't expire. */
async function touch(code: string): Promise<void> {
  const kv = getKv();
  await Promise.all([
    kv.expire(roomKey(code), ROOM_TTL),
    kv.expire(songsKey(code), ROOM_TTL),
    kv.expire(votesKey(code), ROOM_TTL),
    kv.expire(sungKey(code), ROOM_TTL),
  ]);
}

export async function createRoom(): Promise<string> {
  const kv = getKv();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = randomCode();
    if (!(await kv.exists(roomKey(code)))) {
      await kv.set(roomKey(code), new Date().toISOString(), { ex: ROOM_TTL });
      return code;
    }
  }
  throw new Error("Could not allocate a unique room code");
}

export async function roomExists(code: string): Promise<boolean> {
  return getKv().exists(roomKey(code));
}

export interface AddSongResult {
  id: string;
  merged: boolean; // true if it collapsed onto an existing nomination
}

export async function addSong(
  code: string,
  input: { title: string; artist: string | null; clientId: string; name: string },
): Promise<AddSongResult> {
  const kv = getKv();
  const title = input.title.trim();
  const artist = input.artist?.trim() || null;
  const id = songId(title, artist);

  const existing = await kv.hget(songsKey(code), id);
  if (!existing) {
    const song: StoredSong = {
      id,
      title,
      artist,
      nominatedBy: input.name,
      createdAt: new Date().toISOString(),
    };
    await kv.hset(songsKey(code), { [id]: JSON.stringify(song) });
  }
  // Nominating counts as an upvote from the nominator.
  await kv.hset(votesKey(code), { [`${id}${VOTE_SEP}${input.clientId}`]: "1" });
  await touch(code);
  return { id, merged: Boolean(existing) };
}

export async function castVote(
  code: string,
  id: string,
  clientId: string,
  dir: VoteDir,
): Promise<boolean> {
  const kv = getKv();
  if (!(await kv.hget(songsKey(code), id))) return false;
  const field = `${id}${VOTE_SEP}${clientId}`;
  if (dir === 0) await kv.hdel(votesKey(code), field);
  else await kv.hset(votesKey(code), { [field]: String(dir) });
  await touch(code);
  return true;
}

export async function markSung(code: string, id: string): Promise<boolean> {
  const kv = getKv();
  if (!(await kv.hget(songsKey(code), id))) return false;
  await kv.hset(sungKey(code), { [id]: new Date().toISOString() });
  await touch(code);
  return true;
}

export async function getRoom(
  code: string,
  clientId: string,
): Promise<RoomState | null> {
  const kv = getKv();
  if (!(await kv.exists(roomKey(code)))) return null;

  const [songsRaw, votesRaw, sungRaw] = await Promise.all([
    kv.hgetall(songsKey(code)),
    kv.hgetall(votesKey(code)),
    kv.hgetall(sungKey(code)),
  ]);

  // Aggregate votes per song in a single pass.
  const tally = new Map<string, { up: number; down: number; mine: VoteDir }>();
  const get = (id: string) => {
    let t = tally.get(id);
    if (!t) {
      t = { up: 0, down: 0, mine: 0 };
      tally.set(id, t);
    }
    return t;
  };
  for (const [field, value] of Object.entries(votesRaw)) {
    const sep = field.indexOf(VOTE_SEP);
    if (sep === -1) continue;
    const id = field.slice(0, sep);
    const voter = field.slice(sep + VOTE_SEP.length);
    const t = get(id);
    if (value === "1") t.up++;
    else if (value === "-1") t.down++;
    if (voter === clientId) t.mine = value === "1" ? 1 : value === "-1" ? -1 : 0;
  }

  const queue: SongView[] = [];
  const sung: SongView[] = [];
  for (const raw of Object.values(songsRaw)) {
    let s: StoredSong;
    try {
      s = JSON.parse(raw) as StoredSong;
    } catch {
      continue;
    }
    const t = tally.get(s.id) ?? { up: 0, down: 0, mine: 0 as VoteDir };
    const sungAt = sungRaw[s.id] ?? null;
    const view: SongView = {
      id: s.id,
      title: s.title,
      artist: s.artist,
      nominatedBy: s.nominatedBy,
      up: t.up,
      down: t.down,
      score: t.up - t.down,
      myVote: t.mine,
      createdAt: s.createdAt,
      sungAt,
    };
    (sungAt ? sung : queue).push(view);
  }

  queue.sort(
    (a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt),
  );
  sung.sort((a, b) => (b.sungAt ?? "").localeCompare(a.sungAt ?? ""));

  await touch(code);
  return { code, queue, sung };
}
