import { describe, it, expect, vi, beforeEach } from "vitest";
import { Prisma } from "@prisma/client";

// Mock the DB boundary (CI has only a placeholder DATABASE_URL — no real connection).
// vi.hoisted so the mock fns exist when vi.mock's factory is hoisted above the imports.
const { findFirst, groupBy } = vi.hoisted(() => ({ findFirst: vi.fn(), groupBy: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { statement: { findFirst }, transaction: { groupBy } },
}));

import { getOwnedStatement, getStatementCategoryBreakdown } from "./statements";

// The mock "seeds" two users: user-A owns s1; user-B owns nothing.
const STMTS = [{ id: "s1", userId: "user-A", fileName: "a.pdf", status: "PROCESSED" }];

beforeEach(() => {
  vi.clearAllMocks();
  findFirst.mockImplementation(
    async ({ where }: { where: { id: string; userId: string } }) =>
      STMTS.find((s) => s.id === where.id && s.userId === where.userId) ?? null,
  );
});

describe("getOwnedStatement (ownership invariant)", () => {
  it("returns the statement for its owner", async () => {
    expect(await getOwnedStatement("user-A", "s1")).toMatchObject({ id: "s1" });
  });

  // THE highest-value test: a non-owner must never see the row. A missing userId filter
  // would still pass the owner test above — only this negative case catches that breach.
  it("returns null for a non-owner (=> notFound, no cross-user leak)", async () => {
    expect(await getOwnedStatement("user-B", "s1")).toBeNull();
    // ...and proves the query is always scoped by userId, not just by id:
    expect(findFirst).toHaveBeenCalledWith({ where: { id: "s1", userId: "user-B" } });
  });
});

describe("getStatementCategoryBreakdown", () => {
  it("returns Decimal-exact per-category sums/counts, null→OTHER, sorted by |total| desc", async () => {
    groupBy.mockResolvedValue([
      { category: "RENT", _sum: { amount: new Prisma.Decimal("-900") }, _count: 1 },
      { category: "DINING", _sum: { amount: new Prisma.Decimal("-5.50") }, _count: 2 },
      { category: "INCOME", _sum: { amount: new Prisma.Decimal("1250") }, _count: 1 },
      { category: null, _sum: { amount: new Prisma.Decimal("-84.20") }, _count: 3 }, // legacy → OTHER
    ]);

    const result = await getStatementCategoryBreakdown("s1");

    // sorted by absolute total, largest first
    expect(result.map((r) => r.category)).toEqual(["INCOME", "RENT", "OTHER", "DINING"]);

    const other = result.find((r) => r.category === "OTHER")!;
    expect(other.count).toBe(3);
    // Decimal-exact — the DB sum stays precise (no 84.19999… float drift).
    expect(other.total.toFixed(2)).toBe("-84.20");
    expect(result.find((r) => r.category === "INCOME")!.total.toFixed(2)).toBe("1250.00");

    // aggregation scoped to the statement.
    expect(groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ by: ["category"], where: { statementId: "s1" } }),
    );
  });
});
