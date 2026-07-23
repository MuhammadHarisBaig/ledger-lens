import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getOwnedStatementStatus } from "@/lib/statements";

export const runtime = "nodejs";

function fail(code: string, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

// Translate an internal Job.error reason code into a stable, safe, user-facing message. We never
// return Job.error verbatim: codes like "extract_failed"/"persist_failed" are implementation/infra
// detail (information disclosure) and would couple the UI to internal states.
function friendlyFailure(jobError: string | null): string {
  switch (jobError) {
    case "no_text":
      return "We couldn't read text from this PDF — scanned or image-only files aren't supported yet.";
    case "no_transactions":
      return "We couldn't find any transactions in this statement's format.";
    default:
      return "Something went wrong while processing this statement.";
  }
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
    transactionCount: statement._count.transactions,
    message: statement.status === "FAILED" ? friendlyFailure(statement.job?.error ?? null) : null,
  });
}
