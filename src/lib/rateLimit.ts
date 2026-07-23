import { Ratelimit } from "@upstash/ratelimit";
import { getRedis } from "@/lib/redis";
import { UPLOAD_LIMIT_MAX, UPLOAD_LIMIT_WINDOW, UPLOAD_LIMIT_PREFIX } from "@/lib/redisKeys";

/**
 * LAZY per-user upload rate limiter (sliding window). Built on CALL, so getRedis() reads env then
 * — importing this file is side-effect-free (CI-safe, same pattern as the other lazy factories).
 */
export function getUploadLimiter(): Ratelimit {
  return new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(UPLOAD_LIMIT_MAX, UPLOAD_LIMIT_WINDOW),
    prefix: UPLOAD_LIMIT_PREFIX,
  });
}
