import { Redis } from "@upstash/redis";
import { requireEnv } from "@/lib/env";

/**
 * LAZY Redis (REST) client factory — constructed on CALL, reading env then, never at module load.
 * Same CI-safety rationale as getQStashClient: importing this file has no side effects, so the
 * app builds without creds; a missing var throws a clear MissingEnvError at call time.
 */
export function getRedis(): Redis {
  return new Redis({
    url: requireEnv("UPSTASH_REDIS_REST_URL"),
    token: requireEnv("UPSTASH_REDIS_REST_TOKEN"),
  });
}
