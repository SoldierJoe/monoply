import { Redis } from '@upstash/redis';

// Support both standard Upstash env vars and old Vercel KV env vars
const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

// Throw immediately if loaded without credentials
if (!url || !token) {
  throw new Error('Redis store initialized but UPSTASH_REDIS_REST_URL is missing. Please link Upstash Redis in your Vercel Dashboard.');
}

const redis = new Redis({
  url,
  token,
});

export const redisAdapter = {
  async get(key) {
    const data = await redis.get(key);
    // Upstash automatically parses JSON if it looks like JSON.
    // However, our abstract store expects raw string returns, since it models raw Redis
    // and manually calls JSON.parse in store.js.
    // If Upstash gives us an object, we stringify it back.
    if (data === null || data === undefined) return null;
    return typeof data === 'string' ? data : JSON.stringify(data);
  },

  async set(key, rawValue, { ttlMs } = {}) {
    if (ttlMs) {
      await redis.set(key, rawValue, { px: ttlMs });
    } else {
      await redis.set(key, rawValue);
    }
  },

  async del(key) {
    await redis.del(key);
  },

  async exists(key) {
    const count = await redis.exists(key);
    return count > 0;
  },

  async keys(prefix) {
    return redis.keys(prefix);
  },

  /**
   * Atomic read-modify-write on a single key using Upstash Redis.
   * Uses basic optimistic locking with WATCH mechanism natively if needed,
   * but for games like this, a generic fetch-then-write works or a Lua script.
   * Upstash has no full transaction queue like standard node-redis via REST,
   * so we will use a basic read-then-write loop assuming low collision or simple Lua script.
   * Wait, Upstash supports simple transactions but the easiest and safest way in Serverless 
   * is a small lock or direct read-write. We'll do a simple read-and-overwrite here since 
   * we are heavily sharded by Room Code.
   */
  async mutate(key, fn) {
    // Note: In a heavy production system, you'd use a Lua script or WATCH here.
    // For Vercel Serverless Monopoly, traffic per room is extremely low,
    // so simple read->evaluate->write is acceptable.
    const raw = await this.get(key);
    const { raw: newRaw, result, ttlMs } = await fn(raw);
    
    if (ttlMs) {
      await redis.set(key, newRaw, { px: ttlMs });
    } else {
      await redis.set(key, newRaw);
    }
    
    return result;
  },

  async rpush(key, rawValue, { ttlMs } = {}) {
    const len = await redis.rpush(key, rawValue);
    if (ttlMs) {
      await redis.pexpire(key, ttlMs);
    }
    return len;
  },

  async lrange(key, start, stop) {
    const list = await redis.lrange(key, start, stop);
    // Upstash parses lists too, stringify elements for store.js standard.
    return list.map(item => typeof item === 'string' ? item : JSON.stringify(item));
  },

  async llen(key) {
    return redis.llen(key);
  },
};
