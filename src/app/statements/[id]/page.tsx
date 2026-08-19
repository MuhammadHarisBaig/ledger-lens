import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import {
  getOwnedStatement,
  getStatementTransactions,
  getStatementTotal,
  getStatementCategoryBreakdown,
} from "@/lib/statements";
import { categoryColor } from "@/lib/categoryColors";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { MetricCard } from "@/components/MetricCard";
import { StatusBadge } from "@/components/StatusBadge";
import { CategoryBadge } from "@/components/CategoryBadge";
import { Money } from "@/components/Money";

export default async function StatementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireUser();

  // Ownership: not-owned => null => 404 (never reveal another user's data, never confirm the id).
  const statement = await getOwnedStatement(user.id, id);
  if (!statement) notFound();

  const [transactions, totalAgg, breakdown] = await Promise.all([
    getStatementTransactions(id),
    getStatementTotal(id),
    getStatementCategoryBreakdown(id),
  ]);
  const total = totalAgg._sum.amount ?? new Prisma.Decimal(0); // exact Decimal sum from the DB

  // Amounts are negative for money out, positive for money in — so a category's summed total is
  // negative for spending, positive for income. Bucket by net sign so the two don't mix confusingly.
  const spending = breakdown.filter((b) => b.total.isNegative());
  const income = breakdown.filter((b) => b.total.isPositive());
  const totalSpending = spending.reduce((acc, b) => acc.add(b.total.abs()), new Prisma.Decimal(0));
  const totalIncome = income.reduce((acc, b) => acc.add(b.total), new Prisma.Decimal(0));

  return (
    <AppShell user={user}>
      <div className="flex flex-col gap-6">
        <PageHeader
          title={statement.fileName}
          subtitle={`${transactions.length} transaction(s)`}
          backHref="/statements"
          backLabel="All statements"
          actions={<StatusBadge status={statement.status} />}
        />

        {transactions.length === 0 ? (
          <Card className="p-6 text-sm text-fg-muted">
            No transactions were parsed from this statement.
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard label="Income" tone="success">
                <Money value={totalIncome} />
              </MetricCard>
              <MetricCard label="Spending" tone="danger">
                <Money value={totalSpending.negated()} />
              </MetricCard>
              <MetricCard label="Net" tone={total.isNegative() ? "danger" : "success"}>
                <Money value={total} />
              </MetricCard>
            </div>

            <section aria-labelledby="breakdown-heading" className="flex flex-col gap-3">
              <h2 id="breakdown-heading" className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
                Spending by category
              </h2>
              <Card className="flex flex-col gap-5 p-5">
                {spending.length > 0 ? (
                  <div className="flex flex-col gap-4">
                    {spending.map((b) => {
                      const pct = totalSpending.isZero()
                        ? 0
                        : b.total.abs().div(totalSpending).times(100).toNumber();
                      return (
                        <div key={b.category} className="flex flex-col gap-1.5">
                          <div className="flex items-center justify-between text-sm">
                            <CategoryBadge category={b.category} />
                            <span className="text-fg-muted">
                              <Money value={b.total} /> · {b.count}
                            </span>
                          </div>
                          {/* decorative bar (share of total spending); figures are the source of truth */}
                          <div aria-hidden className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: categoryColor(b.category) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-fg-muted">No spending in this statement.</p>
                )}

                {income.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-border pt-4">
                    <h3 className="text-xs font-medium uppercase tracking-wide text-fg-subtle">Income</h3>
                    {income.map((b) => (
                      <div key={b.category} className="flex items-center justify-between text-sm">
                        <CategoryBadge category={b.category} />
                        <span className="text-fg-muted">
                          <Money value={b.total} /> · {b.count}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </section>

            <section aria-labelledby="txns-heading" className="flex flex-col gap-3">
              <h2 id="txns-heading" className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
                Transactions
              </h2>
              <Card className="overflow-hidden">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-subtle">
                      <th scope="col" className="px-4 py-3 font-medium">Date</th>
                      <th scope="col" className="px-4 py-3 font-medium">Description</th>
                      <th scope="col" className="px-4 py-3 font-medium">Category</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((t) => (
                      <tr key={t.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-fg-muted">
                          {t.date.toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-fg">{t.rawDescription}</td>
                        <td className="px-4 py-3">
                          <CategoryBadge category={t.category} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Money value={t.amount} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-border font-semibold">
                      <td className="px-4 py-3" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-right">
                        <Money value={total} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </Card>
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
