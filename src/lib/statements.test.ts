import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the DB boundary (CI has only a placeholder DATABASE_URL — no real connection).
// The mock "seeds" two users: user-A owns s1; user-B owns nothing.
// vi.hoisted so the mock fn exists when vi.mock's factory is hoisted above the imports.
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { statement: { findFirst } } }));

import { getOwnedStatement } from "./statements";

const STMTS = [{ id: "s1", userId: "user-A", fileName: "a.pdf", status: "PROCESSED" }];

beforeEach(() => {
  findFirst.mockReset();
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
