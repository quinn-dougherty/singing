// Shared types for the karaoke queue app.

export type VoteDir = -1 | 0 | 1;

/** A song as rendered on the client. */
export interface SongView {
  id: string;
  title: string;
  artist: string | null;
  nominatedBy: string;
  up: number;
  down: number;
  score: number;
  myVote: VoteDir;
  createdAt: string;
  sungAt: string | null;
}

/** Full state of a room, returned by GET /api/rooms/[code]. */
export interface RoomState {
  code: string;
  queue: SongView[]; // not yet sung, sorted by score desc, then oldest first
  sung: SongView[]; // already sung, most recent first
}

/** Stored shape of a song (without per-viewer vote data). */
export interface StoredSong {
  id: string;
  title: string;
  artist: string | null;
  nominatedBy: string;
  createdAt: string;
}
