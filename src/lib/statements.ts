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
