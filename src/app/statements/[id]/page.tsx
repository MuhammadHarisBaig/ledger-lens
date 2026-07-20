import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import {
  getOwnedStatement,
  getStatementTransactions,
  getStatementTotal,
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

  const [transactions, totalAgg] = await Promise.all([
    getStatementTransactions(id),
    getStatementTotal(id),
  ]);
  const total = totalAgg._sum.amount ?? 0; // exact Decimal sum from the DB

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
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th scope="col" className="py-2 pr-4">Date</th>
              <th scope="col" className="py-2 pr-4">Description</th>
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
                <td className="py-2 text-right tabular-nums">{formatMoney(t.amount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td className="py-2 pr-4" colSpan={2}>Total</td>
              <td className="py-2 text-right tabular-nums">{formatMoney(total)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </main>
  );
}
