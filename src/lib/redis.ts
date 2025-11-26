import Redis from "ioredis";

let client: Redis | null = null;

/**
 * Returns a singleton Redis client.
 * Set REDIS_URL in env (e.g. redis://:password@host:6379/0).
 * If REDIS_URL is not set, returns null (caller should handle).
 */
export function getRedis(): Redis | null {
  if (client) return client;
  const url = process.env.REDIS_URL;
  if (!url) return null;
  client = new Redis(url);
  // Optional: attach error logging
  client.on("error", (err) => {
    console.error("Redis error:", err);
  });
  return client;
}
