import { describe, it, expect } from "vitest";
import { parseStatement } from "./parseStatement";

// A statement text block: 3 valid transactions + noise (header, blank line, running balance).
// Testing on a plain string is the right unit boundary — the parser's contract is
// text -> transactions, decoupled from unpdf / any binary PDF (extraction is tested separately).
const SAMPLE = `Date        Description             Amount
2024-01-05  STARBUCKS COFFEE        -5.50
2024-01-06  ACME PAYROLL            1,250.00
2024-01-07  RENT PAYMENT            (900.00)

Closing Balance                     344.50`;

describe("parseStatement", () => {
  const { transactions, skippedLines } = parseStatement(SAMPLE);

  it("parses exactly the valid transaction lines", () => {
    expect(transactions).toHaveLength(3);
  });

  it("counts the non-transaction lines as skipped (header, blank, balance)", () => {
    expect(skippedLines).toBe(3);
  });

  it("parses date, description, and amount of the first transaction", () => {
    expect(transactions[0].date.toISOString()).toBe("2024-01-05T00:00:00.000Z");
    expect(transactions[0].rawDescription).toBe("STARBUCKS COFFEE");
    expect(transactions[0].amount).toBe(-5.5);
  });

  it("parses a positive amount and a parenthesised (negative) amount", () => {
    expect(transactions[1].amount).toBe(1250);
    expect(transactions[2].amount).toBe(-900);
    expect(transactions[2].rawDescription).toBe("RENT PAYMENT");
  });
});
