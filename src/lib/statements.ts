import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read-side ownership invariant: EVERY statement/transaction read is scoped to the owning
 * user. `getOwnedStatement` filters by both id AND userId, so a statement the caller doesn't
 * own simply isn't found — the page then calls notFound() (404), which (unlike 403) doesn't
 * even confirm the id exists.
 */
export function getOwnedStatement(userId: string, statementId: string) {
  return prisma.statement.findFirst({ where: { id: statementId, userId } });
}

export function listStatements(userId: string) {
  return prisma.statement.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { transactions: true } } },
  });
}

// Only ever called with a statementId already confirmed owned via getOwnedStatement.
export function getStatementTransactions(statementId: string) {
  return prisma.transaction.findMany({ where: { statementId }, orderBy: { date: "asc" } });
}

// Exact money sum: Postgres adds NUMERIC precisely — never a naive JS `+` over Decimals.
export function getStatementTotal(statementId: string) {
  return prisma.transaction.aggregate({ where: { statementId }, _sum: { amount: true } });
}

// Per-category totals, aggregated IN THE DB (exact Decimal sums), sorted by absolute total desc.
// Caller checks ownership first (same contract as getStatementTransactions/getStatementTotal).
export async function getStatementCategoryBreakdown(statementId: string) {
  const groups = await prisma.transaction.groupBy({
    by: ["category"],
    where: { statementId },
    _sum: { amount: true },
    _count: true,
  });
  return groups
    .map((g) => ({
      category: g.category ?? "OTHER", // legacy pre-categorization rows are null → OTHER
      total: g._sum.amount ?? new Prisma.Decimal(0), // Prisma.Decimal (exact)
      count: g._count,
    }))
    .sort((a, b) => b.total.abs().comparedTo(a.total.abs())); // Decimal compare, never float
}

// Ownership-scoped status snapshot for the polling endpoint — null for a non-owner (=> 404).
export function getOwnedStatementStatus(userId: string, statementId: string) {
  return prisma.statement.findFirst({
    where: { id: statementId, userId },
    select: {
      status: true,
      job: { select: { state: true, error: true, attempts: true } },
      _count: { select: { transactions: true } },
    },
  });
}
