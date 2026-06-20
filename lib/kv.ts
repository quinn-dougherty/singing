// A minimal key/value interface used by the app, with two backends:
//   - Upstash Redis (when KV_REST_API_* / UPSTASH_REDIS_REST_* env vars exist)
//   - An in-memory store (local dev, zero config)
//
// Vercel is serverless, so in-memory state does NOT persist across requests in
// production — the memory backend is strictly a local-dev convenience. Provision
// an Upstash Redis (Vercel Marketplace) and the app switches over automatically.

import { Redis } from "@upstash/redis";

export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, opts?: { ex?: number }): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  expire(key: string, seconds: number): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hgetall(key: string): Promise<Record<string, string>>;
  hset(key: string, entries: Record<string, string>): Promise<void>;
  hdel(key: string, ...fields: string[]): Promise<void>;
}

function upstashFromEnv(): Redis | null {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  // Keep values as plain strings; we serialize JSON ourselves.
  return new Redis({ url, token, automaticDeserialization: false });
}

class UpstashKV implements KV {
  constructor(private redis: Redis) {}

  get(key: string) {
    return this.redis.get<string>(key).then((v) => v ?? null);
  }
  async set(key: string, value: string, opts?: { ex?: number }) {
    if (opts?.ex) await this.redis.set(key, value, { ex: opts.ex });
    else await this.redis.set(key, value);
  }
  async del(key: string) {
    await this.redis.del(key);
  }
  exists(key: string) {
    return this.redis.exists(key).then((n) => n > 0);
  }
  async expire(key: string, seconds: number) {
    await this.redis.expire(key, seconds);
  }
  hget(key: string, field: string) {
    return this.redis.hget<string>(key, field).then((v) => v ?? null);
  }
  hgetall(key: string) {
    return this.redis
      .hgetall<Record<string, string>>(key)
      .then((v) => v ?? {});
  }
  async hset(key: string, entries: Record<string, string>) {
    if (Object.keys(entries).length) await this.redis.hset(key, entries);
  }
  async hdel(key: string, ...fields: string[]) {
    if (fields.length) await this.redis.hdel(key, ...fields);
  }
}

type MemEntry = { value: unknown; expiresAt: number | null };

class MemoryKV implements KV {
  private store: Map<string, MemEntry>;

  constructor(store: Map<string, MemEntry>) {
    this.store = store;
  }

  private live(key: string): MemEntry | null {
    const e = this.store.get(key);
    if (!e) return null;
    if (e.expiresAt !== null && e.expiresAt < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return e;
  }

  private hash(key: string): Map<string, string> {
    const e = this.live(key);
    if (e && e.value instanceof Map) return e.value as Map<string, string>;
    const m = new Map<string, string>();
    this.store.set(key, { value: m, expiresAt: e?.expiresAt ?? null });
    return m;
  }

  async get(key: string) {
    const e = this.live(key);
    return e && typeof e.value === "string" ? e.value : null;
  }
  async set(key: string, value: string, opts?: { ex?: number }) {
    this.store.set(key, {
      value,
      expiresAt: opts?.ex ? Date.now() + opts.ex * 1000 : null,
    });
  }
  async del(key: string) {
    this.store.delete(key);
  }
  async exists(key: string) {
    return this.live(key) !== null;
  }
  async expire(key: string, seconds: number) {
    const e = this.live(key);
    if (e) e.expiresAt = Date.now() + seconds * 1000;
  }
  async hget(key: string, field: string) {
    return this.hash(key).get(field) ?? null;
  }
  async hgetall(key: string) {
    return Object.fromEntries(this.hash(key));
  }
  async hset(key: string, entries: Record<string, string>) {
    const h = this.hash(key);
    for (const [f, v] of Object.entries(entries)) h.set(f, v);
  }
  async hdel(key: string, ...fields: string[]) {
    const h = this.hash(key);
    for (const f of fields) h.delete(f);
  }
}

// Reuse one memory store across hot reloads in dev.
const globalForKv = globalThis as unknown as {
  __karaokeMem?: Map<string, MemEntry>;
  __karaokeKv?: KV;
};

export function getKv(): KV {
  if (globalForKv.__karaokeKv) return globalForKv.__karaokeKv;
  const redis = upstashFromEnv();
  if (redis) {
    globalForKv.__karaokeKv = new UpstashKV(redis);
  } else {
    if (!globalForKv.__karaokeMem) globalForKv.__karaokeMem = new Map();
    globalForKv.__karaokeKv = new MemoryKV(globalForKv.__karaokeMem);
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[karaoke] No Redis env vars found — using in-memory store (dev only).",
      );
    }
  }
  return globalForKv.__karaokeKv;
}
