import { Redis } from 'ioredis';

const url = process.env.REDIS_URL;

if (!url) {
  throw new Error('Redis store initialized but REDIS_URL is missing.');
}

// ioredis connection pool size must be small for serverless
const redis = new Redis(url, {
  maxRetriesPerRequest: 1,
  showFriendlyErrorStack: true
});

export const redisAdapter = {
  async get(key) {
    // ioredis fetches raw string
    return redis.get(key);
  },

  async set(key, rawValue, { ttlMs } = {}) {
    if (ttlMs) {
      await redis.set(key, rawValue, 'PX', ttlMs);
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
   * Atomic read-modify-write on a single key.
   * Simple read->write for serverless speed.
   */
  async mutate(key, fn) {
    const raw = await this.get(key);
    const { raw: newRaw, result, ttlMs } = await fn(raw);
    
    if (ttlMs) {
      await redis.set(key, newRaw, 'PX', ttlMs);
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
    return redis.lrange(key, start, stop);
  },

  async llen(key) {
    return redis.llen(key);
  },
};
