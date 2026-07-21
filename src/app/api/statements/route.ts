import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { validateUpload, MAX_UPLOAD_BYTES } from "@/lib/validateUpload";
import { getQStashClient } from "@/lib/qstash";
import { WORKER_PATH } from "@/lib/queue";
import { putStatementPdf, deleteBlob } from "@/lib/blob";

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

  // Store the raw PDF FIRST. If this fails we create NO rows — nothing to clean up.
  let blob: { url: string; pathname: string };
  try {
    blob = await putStatementPdf(bytes, file.name);
  } catch {
    return fail("STORAGE_FAILED", "Could not store the uploaded file.", 502);
  }

  // Create the Statement (UPLOADED, with its blob URL) AND its Job (QUEUED) together, so we never
  // end up with a Statement that has no Job to track its processing.
  let statement: { id: string; status: string };
  let job: { id: string };
  try {
    ({ statement, job } = await prisma.$transaction(async (tx) => {
      const statement = await tx.statement.create({
        data: {
          userId: user.id,
          fileName: file.name,
          contentHash,
          status: "UPLOADED",
          blobUrl: blob.url,
        },
      });
      const job = await tx.job.create({ data: { statementId: statement.id, state: "QUEUED" } });
      return { statement, job };
    }));
  } catch (e) {
    // Rows weren't committed → the blob we just stored would be orphaned. Delete it either way.
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      // Race: a concurrent request already created this (userId, contentHash).
      const raced = await prisma.statement.findUnique({
        where: { userId_contentHash: { userId: user.id, contentHash } },
      });
      if (raced) {
        await deleteBlob(blob.url);
        return summarize(raced);
      }
    }
    await deleteBlob(blob.url);
    return fail("INTERNAL_ERROR", "Could not process the upload.", 500);
  }

  // Publish AFTER the rows exist. Payload carries ONLY identifiers — NEVER the blob url, file
  // bytes, or text. The financial-file reference stays in our DB; the worker (3D) reads blobUrl
  // from the Statement, fetches, processes, then deletes the blob. Worker URL from request origin.
  const workerUrl = new URL(WORKER_PATH, req.url).toString();
  try {
    await getQStashClient().publishJSON({
      url: workerUrl,
      body: { statementId: statement.id, jobId: job.id },
    });
  } catch {
    // Enqueue failed: mark FAILED AND delete the stored blob so we don't orphan a financial PDF
    // (storage cost + a needlessly-reachable file) with no message that will ever process it.
    await prisma.$transaction([
      prisma.job.update({ where: { id: job.id }, data: { state: "FAILED", error: "enqueue_failed" } }),
      prisma.statement.update({ where: { id: statement.id }, data: { status: "FAILED" } }),
    ]);
    await deleteBlob(blob.url);
    return fail("ENQUEUE_FAILED", "Could not queue the statement for processing.", 502);
  }

  // 202 Accepted: accepted for async processing, not completed. Job is QUEUED; the worker (3D)
  // does the actual work.
  return NextResponse.json(
    { statementId: statement.id, jobId: job.id, status: "queued" },
    { status: 202 },
  );
}
