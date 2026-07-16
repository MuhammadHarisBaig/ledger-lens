import { describe, it, expect } from "vitest";
import { parseAmount } from "./parseAmount";

describe("parseAmount", () => {
  it("strips thousands separators", () => {
    expect(parseAmount("1,250.00")).toBe(1250);
  });

  it("parses a plain decimal", () => {
    expect(parseAmount("45.99")).toBe(45.99);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseAmount("  10.00 ")).toBe(10);
  });

  // The test I'd expect to matter later: real statements have junk rows.
  // A parser that silently returns NaN corrupts every downstream total,
  // so we assert it fails loudly instead.
  it("throws on non-numeric input", () => {
    expect(() => parseAmount("N/A")).toThrow();
  });
});
