import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/validateUpload";
import { extractPdfText } from "@/lib/extractPdfText";

export const runtime = "nodejs"; // node:crypto + Prisma need the Node runtime, not Edge

function fail(code: string, message: string, status: number) {
  // envelope only — never leak raw errors or stack traces to the client
  return NextResponse.json({ error: { code, message } }, { status });
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
    return NextResponse.json({ statementId: existing.id, status: existing.status }, { status: 200 });
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
        return NextResponse.json({ statementId: raced.id, status: raced.status }, { status: 200 });
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

  // Privacy: return COUNTS only — never the extracted text (sensitive financial data), never log it.
  return NextResponse.json(
    {
      statementId: statement.id,
      status: statement.status, // UPLOADED — parsing/PROCESSED comes in 2D
      extractedChars: extraction.text.length,
      pageCount: extraction.pageCount,
    },
    { status: 201 },
  );
}
