import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/validateUpload";
import { extractPdfText } from "@/lib/extractPdfText";
import { parseStatement } from "@/lib/parseStatement";

export const runtime = "nodejs"; // node:crypto + Prisma need the Node runtime, not Edge

function fail(code: string, message: string, status: number) {
  // envelope only — never leak raw errors or stack traces to the client
  return NextResponse.json({ error: { code, message } }, { status });
}

// Idempotent summary for a statement we're NOT (re)processing this request.
async function summarize(s: { id: string; status: string }) {
  const transactionCount = await prisma.transaction.count({ where: { statementId: s.id } });
  // skippedLines isn't persisted, so it's only meaningful on first processing; report 0 here.
  return NextResponse.json(
    { statementId: s.id, status: s.status, transactionCount, skippedLines: 0 },
    { status: 200 },
  );
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", "You must be signed in.", 401);

  // cheap pre-read DoS guard: reject on declared Content-Length before buffering the body
  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES) {
    return fail("FILE_TOO_LARGE", "File exceeds the 10 MB limit.", 413);
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return fail("INVALID_REQUEST", "Expected multipart form data.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return fail("NO_FILE", "No file was provided.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = validateUpload({ bytes, declaredType: file.type, size: bytes.length });
  if (!result.ok) {
    return fail(result.code, result.message, result.code === "FILE_TOO_LARGE" ? 413 : 400);
  }

  // idempotency fingerprint: identical bytes => identical hash
  const contentHash = createHash("sha256").update(bytes).digest("hex");

  // SECURITY: never log file bytes/contents. Only ids / status / size are safe to log —
  // e.g. { userId: user.id, size: bytes.length }, NEVER the bytes themselves.

  // (a) app-level idempotency check — clean UX: return the existing row instead of erroring
  const existing = await prisma.statement.findUnique({
    where: { userId_contentHash: { userId: user.id, contentHash } },
  });
  if (existing) {
    return summarize(existing);
  }

  let statement;
  try {
    statement = await prisma.statement.create({
      data: { userId: user.id, fileName: file.name, contentHash, status: "UPLOADED" },
    });
  } catch (e) {
    // (b) DB-constraint fallback: a concurrent request may have inserted between our check and
    // this create (TOCTOU race). @@unique([userId, contentHash]) throws P2002 — treat it as
    // "already exists" and return that row rather than surfacing an error.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await prisma.statement.findUnique({
        where: { userId_contentHash: { userId: user.id, contentHash } },
      });
      if (raced) {
        return summarize(raced);
      }
    }
    return fail("INTERNAL_ERROR", "Could not process the upload.", 500);
  }

  // M2 sync skeleton: extract text inline. M3 will move this to a background worker.
  let extraction;
  try {
    extraction = await extractPdfText(bytes);
  } catch {
    await prisma.statement.update({ where: { id: statement.id }, data: { status: "FAILED" } });
    return fail("EXTRACTION_FAILED", "Could not read text from the PDF.", 422);
  }
  if (!extraction.hasText) {
    await prisma.statement.update({ where: { id: statement.id }, data: { status: "FAILED" } });
    return fail("NO_TEXT", "No extractable text found — scanned/image PDFs aren't supported.", 422);
  }

  // Idempotency guard: only parse a still-UPLOADED statement; an already PROCESSED/FAILED row
  // must never be re-parsed or double-inserted — return its existing summary instead.
  if (statement.status !== "UPLOADED") return summarize(statement);

  const parsed = parseStatement(extraction.text);

  // Partial success: 0 parseable lines => FAILED (nothing to insert); surface skippedLines.
  if (parsed.transactions.length === 0) {
    await prisma.statement.update({ where: { id: statement.id }, data: { status: "FAILED" } });
    return NextResponse.json(
      { statementId: statement.id, status: "FAILED", transactionCount: 0, skippedLines: parsed.skippedLines },
      { status: 200 },
    );
  }

  // Atomic: insert all transactions AND flip status together, so we can never end up with
  // half-inserted rows or a PROCESSED statement missing its transactions.
  await prisma.$transaction([
    prisma.transaction.createMany({
      data: parsed.transactions.map((t) => ({
        statementId: statement.id,
        date: t.date,
        rawDescription: t.rawDescription,
        amount: t.amount, // currency defaults to "USD"
      })),
    }),
    prisma.statement.update({ where: { id: statement.id }, data: { status: "PROCESSED" } }),
  ]);

  // Privacy: counts only — never transaction contents/amounts in the response or logs.
  return NextResponse.json(
    {
      statementId: statement.id,
      status: "PROCESSED",
      transactionCount: parsed.transactions.length,
      skippedLines: parsed.skippedLines,
    },
    { status: 201 },
  );
}
