import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listStatements } from "@/lib/statements";
import { UploadForm } from "@/components/UploadForm";

export default async function StatementsPage() {
  const user = await requireUser();
  const statements = await listStatements(user.id);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Statements</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Upload a statement PDF to parse its transactions.
        </p>
      </header>

      <section aria-labelledby="upload-heading" className="flex flex-col gap-3">
        <h2 id="upload-heading" className="text-lg font-semibold">
          Upload
        </h2>
        <UploadForm />
      </section>

      <section aria-labelledby="list-heading" className="flex flex-col gap-3">
        <h2 id="list-heading" className="text-lg font-semibold">
          Your statements
        </h2>
        {statements.length === 0 ? (
          <p className="text-sm text-gray-600 dark:text-gray-400">No statements yet.</p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th scope="col" className="py-2 pr-4">File</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4 text-right">Transactions</th>
                <th scope="col" className="py-2">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {statements.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 pr-4">
                    <Link href={`/statements/${s.id}`} className="underline">
                      {s.fileName}
                    </Link>
                  </td>
                  <td className="py-2 pr-4">{s.status}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{s._count.transactions}</td>
                  <td className="py-2">{s.createdAt.toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
