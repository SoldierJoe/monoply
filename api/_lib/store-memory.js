/**
 * In-memory adapter for the Redis-like store. Module-scoped state survives
 * across requests on a warm Vercel instance.
 *
 * Each key has an optional expiry (ms epoch). A sweep on every read/write
 * evicts dead keys, so stale rooms vanish on the next access without needing
 * a background timer (which serverless can't reliably run).
 *
 * Per-key serialization: mutate() / rpush() chain on a per-key promise so
 * concurrent requests on the same key can't interleave reads and writes.
 */

const store = new Map();        // key -> { raw: string, expiresAt: number|null }
const lists = new Map();        // key -> { items: string[], expiresAt: number|null }
const locks = new Map();        // key -> Promise (per-key serialization)

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes — overridable per call

function now() {
  return Date.now();
}

function isExpired(entry) {
  return entry.expiresAt !== null && entry.expiresAt <= now();
}

function setExpiry(entry, ttlMs) {
  entry.expiresAt = ttlMs === 0 ? null : now() + (ttlMs ?? DEFAULT_TTL_MS);
}

function sweep(key) {
  const kv = store.get(key);
  if (kv && isExpired(kv)) store.delete(key);
  const list = lists.get(key);
  if (list && isExpired(list)) lists.delete(key);
}

async function withLock(key, fn) {
  const prev = locks.get(key) ?? Promise.resolve();
  let resolveNext;
  const next = new Promise((r) => { resolveNext = r; });
  locks.set(key, prev.then(() => next));
  try {
    await prev;
    return await fn();
  } finally {
    resolveNext();
    // Clean up the lock map opportunistically — only if we're still the tail.
    if (locks.get(key) === next) locks.delete(key);
  }
}

export const memoryAdapter = {
  async get(key) {
    sweep(key);
    const entry = store.get(key);
    return entry ? entry.raw : null;
  },

  async set(key, raw, { ttlMs } = {}) {
    const entry = { raw, expiresAt: null };
    setExpiry(entry, ttlMs);
    store.set(key, entry);
  },

  async del(key) {
    store.delete(key);
    lists.delete(key);
  },

  async exists(key) {
    sweep(key);
    return store.has(key) || lists.has(key);
  },

  async keys(prefix) {
    const out = [];
    for (const k of store.keys()) {
      sweep(k);
      if (store.has(k) && k.startsWith(prefix)) out.push(k);
    }
    return out;
  },

  async mutate(key, fn) {
    return withLock(key, async () => {
      sweep(key);
      const entry = store.get(key);
      const raw = entry ? entry.raw : null;
      const { raw: nextRaw, result, ttlMs } = await fn(raw);
      const nextEntry = { raw: nextRaw, expiresAt: null };
      setExpiry(nextEntry, ttlMs);
      store.set(key, nextEntry);
      return result;
    });
  },

  async rpush(key, raw, { ttlMs } = {}) {
    return withLock(key, async () => {
      sweep(key);
      let list = lists.get(key);
      if (!list) {
        list = { items: [], expiresAt: null };
        lists.set(key, list);
      }
      list.items.push(raw);
      setExpiry(list, ttlMs);
      return list.items.length;
    });
  },

  async lrange(key, start, stop) {
    sweep(key);
    const list = lists.get(key);
    if (!list) return [];
    const len = list.items.length;
    const s = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
    const e = stop < 0 ? len + stop + 1 : Math.min(stop + 1, len);
    return list.items.slice(s, e);
  },

  async llen(key) {
    sweep(key);
    const list = lists.get(key);
    return list ? list.items.length : 0;
  },
};
