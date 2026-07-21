import { describe, it, expect, afterEach } from "vitest";
import { getBlobToken } from "./blob";
import { MissingEnvError } from "./env";

const original = process.env.BLOB_READ_WRITE_TOKEN;
afterEach(() => {
  if (original === undefined) delete process.env.BLOB_READ_WRITE_TOKEN;
  else process.env.BLOB_READ_WRITE_TOKEN = original;
});

describe("getBlobToken", () => {
  // Same lazy-client contract as qstash/redis: a missing token fails loudly + early, not deep
  // inside the Vercel Blob SDK on first upload.
  it("throws a clear MissingEnvError when BLOB_READ_WRITE_TOKEN is unset", () => {
    delete process.env.BLOB_READ_WRITE_TOKEN;
    expect(() => getBlobToken()).toThrow(MissingEnvError);
    expect(() => getBlobToken()).toThrow(/BLOB_READ_WRITE_TOKEN/);
  });
});
