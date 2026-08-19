import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/Card";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/Button";

export default async function DashboardPage() {
  const user = await requireUser(); // redirects to sign-in if not authenticated
  return (
    <AppShell user={user}>
      <div className="flex flex-col gap-6">
        <PageHeader title="Dashboard" subtitle={`Signed in as ${user.name ?? user.email}`} />
        <Card className="flex flex-col items-start gap-4 p-6">
          <p className="text-sm text-fg-muted">
            Upload bank or credit-card statements to parse and categorize their transactions.
          </p>
          <Link href="/statements">
            <Button variant="primary">Go to statements →</Button>
          </Link>
        </Card>
      </div>
    </AppShell>
  );
}
