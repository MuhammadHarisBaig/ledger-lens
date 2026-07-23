import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOwnedStatementStatus } from "@/lib/statements";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", "You must be signed in.", 401);

  // Ownership: not-owned => null => 404 (never reveal another user's statement exists).
  const statement = await getOwnedStatementStatus(user.id, id);
  if (!statement) return fail("NOT_FOUND", "Statement not found.", 404);

  return NextResponse.json({
    status: statement.status, // UPLOADED | PROCESSING | PROCESSED | FAILED
    jobState: statement.job?.state ?? null,
    error: statement.job?.error ?? null, // safe reason codes only (no PII)
    transactionCount: statement._count.transactions,
  });
}
