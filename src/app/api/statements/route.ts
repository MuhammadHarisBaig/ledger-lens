import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/validateUpload";
import { getQStashClient } from "@/lib/qstash";
import { WORKER_PATH } from "@/lib/queue";

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

  // Create the Statement (UPLOADED) AND its Job (QUEUED) together, so we never end up with a
  // Statement that has no Job to track its processing.
  let statement: { id: string; status: string };
  let job: { id: string };
  try {
    ({ statement, job } = await prisma.$transaction(async (tx) => {
      const statement = await tx.statement.create({
        data: { userId: user.id, fileName: file.name, contentHash, status: "UPLOADED" },
      });
      const job = await tx.job.create({ data: { statementId: statement.id, state: "QUEUED" } });
      return { statement, job };
    }));
  } catch (e) {
    // P2002 race: a concurrent request already created this (userId, contentHash). Return the
    // existing row's summary and do NOT enqueue again.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      const raced = await prisma.statement.findUnique({
        where: { userId_contentHash: { userId: user.id, contentHash } },
      });
      if (raced) return summarize(raced);
    }
    return fail("INTERNAL_ERROR", "Could not process the upload.", 500);
  }

  // Publish AFTER the rows exist. The payload carries ONLY identifiers — NEVER file bytes or
  // extracted text. Financial data must not transit the external queue; the worker (3C) re-reads
  // it from our own DB/storage. Worker URL is derived from the request origin (no new env var).
  const workerUrl = new URL(WORKER_PATH, req.url).toString();
  try {
    await getQStashClient().publishJSON({
      url: workerUrl,
      body: { statementId: statement.id, jobId: job.id },
    });
  } catch {
    // Enqueue failed: don't leave a QUEUED job with no message behind it (a silent stuck state).
    // Mark both FAILED so the failure is visible and retriable, then surface it.
    await prisma.$transaction([
      prisma.job.update({ where: { id: job.id }, data: { state: "FAILED", error: "enqueue_failed" } }),
      prisma.statement.update({ where: { id: statement.id }, data: { status: "FAILED" } }),
    ]);
    return fail("ENQUEUE_FAILED", "Could not queue the statement for processing.", 502);
  }

  // 202 Accepted: the upload was accepted for asynchronous processing, not completed. Nothing is
  // parsed yet (Job is QUEUED); the worker (3C) does the actual work.
  return NextResponse.json(
    { statementId: statement.id, jobId: job.id, status: "queued" },
    { status: 202 },
  );
}
