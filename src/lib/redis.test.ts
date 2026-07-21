import { describe, it, expect, afterEach } from "vitest";
import { getRedis } from "./redis";
import { MissingEnvError } from "./env";

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;
afterEach(() => {
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
});

describe("getRedis", () => {
  it("throws a clear MissingEnvError when the Redis env vars are unset", () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    expect(() => getRedis()).toThrow(MissingEnvError);
    expect(() => getRedis()).toThrow(/UPSTASH_REDIS_REST_URL/);
  });
});
