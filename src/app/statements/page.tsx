import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listStatements } from "@/lib/statements";
import { UploadForm } from "@/components/UploadForm";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";

export default async function StatementsPage() {
  const user = await requireUser();
  const statements = await listStatements(user.id);

  return (
    <AppShell user={user}>
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Statements"
          subtitle="Upload a statement PDF to parse and categorize its transactions."
        />

        <section aria-labelledby="upload-heading" className="flex flex-col gap-3">
          <h2 id="upload-heading" className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
            Upload
          </h2>
          <Card className="p-5">
            <UploadForm />
          </Card>
        </section>

        <section aria-labelledby="list-heading" className="flex flex-col gap-3">
          <h2 id="list-heading" className="text-sm font-semibold uppercase tracking-wide text-fg-subtle">
            Your statements
          </h2>
          {statements.length === 0 ? (
            <Card className="p-6 text-sm text-fg-muted">No statements yet.</Card>
          ) : (
            <Card className="overflow-hidden">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-fg-subtle">
                    <th scope="col" className="px-4 py-3 font-medium">File</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 text-right font-medium">Transactions</th>
                    <th scope="col" className="px-4 py-3 font-medium">Uploaded</th>
                  </tr>
                </thead>
                <tbody>
                  {statements.map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0 hover:bg-surface-2/40">
                      <td className="px-4 py-3">
                        <Link href={`/statements/${s.id}`} className="text-fg hover:text-accent">
                          {s.fileName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={s.status} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-fg-muted">
                        {s._count.transactions}
                      </td>
                      <td className="px-4 py-3 text-fg-muted">{s.createdAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </section>
      </div>
    </AppShell>
  );
}
