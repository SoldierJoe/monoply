export default function handler(req, res) {
  res.json({
    hasRedisUrl: !!process.env.REDIS_URL,
    hasUpstashUrl: !!process.env.UPSTASH_REDIS_REST_URL,
    nodeEnv: process.env.NODE_ENV
  });
}
