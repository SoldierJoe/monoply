/**
 * Redis-like KV store interface.
 *
 * Game code only ever talks to this module. The backing implementation lives
 * in store-memory.js and can be swapped (Upstash, real Redis, etc.) without
 * touching game logic.
 *
 * Values are JSON-serialized on write and parsed on read, mirroring how a
 * real Redis client would behave — this keeps the in-memory adapter honest
 * about what's serializable.
 */

import { memoryAdapter } from './store-memory.js';

let adapter = memoryAdapter;

// Try to use Redis if REDIS_URL env var is present.
// Note: In Vercel, dynamic imports inside standard Serverless Functions 
// can be tricky. We use top-level logic here to determine the adapter.
if (process.env.REDIS_URL) {
  const { redisAdapter } = await import('./store-redis.js');
  adapter = redisAdapter;
  console.log('[store] Using ioredis adapter');
} else {
  console.log('[store] Using in-memory adapter');
}

export const store = {
  async get(key) {
    const raw = await adapter.get(key);
    return raw === null || raw === undefined ? null : JSON.parse(raw);
  },

  async set(key, value, { ttlMs } = {}) {
    await adapter.set(key, JSON.stringify(value), { ttlMs });
  },

  async del(key) {
    await adapter.del(key);
  },

  async exists(key) {
    return adapter.exists(key);
  },

  async keys(prefix) {
    return adapter.keys(prefix);
  },

  /**
   * Atomic read-modify-write on a single key. Returns whatever `fn` returns,
   * after persisting the (possibly mutated) value.
   *
   * In a real Redis deploy this would use WATCH/MULTI/EXEC or a Lua script;
   * the in-memory adapter serializes via a per-key promise chain.
   */
  async mutate(key, fn, { ttlMs } = {}) {
    return adapter.mutate(key, async (raw) => {
      const value = raw === null || raw === undefined ? null : JSON.parse(raw);
      const result = await fn(value);
      // Convention: fn may either return a result and mutate `value` in place,
      // or return a new value via `{ value: newValue, result }`.
      if (result && typeof result === 'object' && 'value' in result) {
        return { raw: JSON.stringify(result.value), result: result.result, ttlMs };
      }
      return { raw: JSON.stringify(value), result, ttlMs };
    });
  },

  /**
   * Append to a list. Used by the event log.
   * Returns the new length (i.e. the seq of the appended item, 1-indexed).
   */
  async rpush(key, value, { ttlMs } = {}) {
    return adapter.rpush(key, JSON.stringify(value), { ttlMs });
  },

  /**
   * Range read on a list. start/stop are 0-indexed, inclusive on both ends,
   * matching Redis LRANGE semantics. Negative indices count from the end.
   */
  async lrange(key, start, stop) {
    const raws = await adapter.lrange(key, start, stop);
    return raws.map((r) => JSON.parse(r));
  },

  async llen(key) {
    return adapter.llen(key);
  },
};
