import { describe, it, expect, afterEach } from "vitest";
import { getQStashClient } from "./qstash";
import { MissingEnvError } from "./env";

const original = process.env.QSTASH_TOKEN;
afterEach(() => {
  if (original === undefined) delete process.env.QSTASH_TOKEN;
  else process.env.QSTASH_TOKEN = original;
});

describe("getQStashClient", () => {
  // Turning a confusing deep-SDK failure ("cannot read token of undefined" on first publish)
  // into a clear, early, named error is an operational-safety invariant worth locking with a test.
  it("throws a clear MissingEnvError when QSTASH_TOKEN is unset", () => {
    delete process.env.QSTASH_TOKEN;
    expect(() => getQStashClient()).toThrow(MissingEnvError);
    expect(() => getQStashClient()).toThrow(/QSTASH_TOKEN/);
  });
});
