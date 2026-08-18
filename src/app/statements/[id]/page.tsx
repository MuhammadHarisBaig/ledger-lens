import Link from "next/link";
import { notFound } from "next/navigation";
import { Prisma } from "@prisma/client";
import { requireUser } from "@/lib/auth";
import {
  getOwnedStatement,
  getStatementTransactions,
  getStatementTotal,
  getStatementCategoryBreakdown,
} from "@/lib/statements";
import { formatMoney } from "@/lib/formatMoney";

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
  const total = totalAgg._sum.amount ?? 0; // exact Decimal sum from the DB

  // Amounts are negative for money out, positive for money in — so a category's summed total is
  // negative for spending, positive for income. Bucket by net sign so the two don't mix confusingly.
  const spending = breakdown.filter((b) => b.total.isNegative());
  const income = breakdown.filter((b) => b.total.isPositive());
  const totalSpending = spending.reduce(
    (acc, b) => acc.add(b.total.abs()),
    new Prisma.Decimal(0),
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div>
        <Link href="/statements" className="text-sm underline">
          ← All statements
        </Link>
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">{statement.fileName}</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {statement.status} · {transactions.length} transaction(s)
        </p>
      </header>

      {transactions.length === 0 ? (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          No transactions were parsed from this statement.
        </p>
      ) : (
        <>
          <section aria-labelledby="breakdown-heading" className="flex flex-col gap-4">
            <h2 id="breakdown-heading" className="text-lg font-semibold">
              Spending by category
            </h2>
            {spending.length > 0 ? (
              <div className="flex flex-col gap-2">
                {spending.map((b) => {
                  const pct = totalSpending.isZero()
                    ? 0
                    : b.total.abs().div(totalSpending).times(100).toNumber();
                  return (
                    <div key={b.category} className="flex flex-col gap-1">
                      <div className="flex justify-between text-sm">
                        <span>{b.category}</span>
                        <span className="tabular-nums">
                          {formatMoney(b.total)} · {b.count}
                        </span>
                      </div>
                      {/* decorative bar (share of total spending); figures are the source of truth */}
                      <div aria-hidden className="h-2 w-full rounded bg-gray-200 dark:bg-gray-800">
                        <div
                          className="h-2 rounded bg-gray-500 dark:bg-gray-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-600 dark:text-gray-400">No spending in this statement.</p>
            )}
            {income.length > 0 && (
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">Income</h3>
                {income.map((b) => (
                  <div key={b.category} className="flex justify-between text-sm">
                    <span>{b.category}</span>
                    <span className="tabular-nums">
                      {formatMoney(b.total)} · {b.count}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2 pr-4">Date</th>
              <th scope="col" className="py-2 pr-4">Description</th>
              <th scope="col" className="py-2 pr-4">Category</th>
              <th scope="col" className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} className="border-b">
                <td className="py-2 pr-4 whitespace-nowrap">
                  {t.date.toLocaleDateString()}
                </td>
                <td className="py-2 pr-4">{t.rawDescription}</td>
                <td className="py-2 pr-4">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                    {t.category ?? "—"}
                  </span>
                </td>
                <td className="py-2 text-right tabular-nums">{formatMoney(t.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-4" colSpan={3}>Total</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
        </>
      )}
    </main>
  );
}
