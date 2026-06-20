// Pure helpers safe to import from both client and server (no node deps).

/** Normalize text for dedup / comparison: trim, collapse whitespace, lowercase. */
export function normalizeText(s: string): string {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Google search URL that surfaces the song's Ultimate Guitar page. */
export function songSearchUrl(title: string, artist: string | null): string {
  const q = [title, artist, "ultimate guitar"].filter(Boolean).join(" ");
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
