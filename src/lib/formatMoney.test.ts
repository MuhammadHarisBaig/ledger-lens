import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { formatMoney } from "./formatMoney";

describe("formatMoney", () => {
  it("formats a positive number with 2 decimals", () => {
    expect(formatMoney(1250)).toBe("1,250.00");
  });

  it("formats a negative number", () => {
    expect(formatMoney(-1250)).toBe("-1,250.00");
  });

  it("adds thousands separators for large amounts", () => {
    expect(formatMoney(1234567.89)).toBe("1,234,567.89");
  });

  it("accepts a string input", () => {
    expect(formatMoney("45.5")).toBe("45.50");
  });

  it("accepts a Prisma.Decimal input (the real DB type)", () => {
    expect(formatMoney(new Prisma.Decimal("-900"))).toBe("-900.00");
  });
});
