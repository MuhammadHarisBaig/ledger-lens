import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getQStashReceiver } from "@/lib/qstash";
import { getRedis } from "@/lib/redis";
import { JOB_LOCK_PREFIX, JOB_LOCK_TTL_SECONDS } from "@/lib/redisKeys";
import { fetchStatementPdf, deleteBlob } from "@/lib/blob";
import { extractPdfText } from "@/lib/extractPdfText";
import { parseStatement } from "@/lib/parseStatement";

export const runtime = "nodejs"; // node crypto + Prisma + blob need the Node runtime, not Edge

const bodySchema = z.object({ statementId: z.string(), jobId: z.string() });

// 200 = "handled" (QStash will NOT retry). 500 = transient (QStash WILL retry).
const ok = () => NextResponse.json({ ok: true }, { status: 200 });
const retry = () => NextResponse.json({ ok: false }, { status: 500 });

// SECURITY: only ids/status/stage/attempts are ever safe to log — NEVER bytes/text/txn/blobUrl.

// Delete the stored PDF + drop the reference. Best-effort: a stray blob after a terminal outcome
// is a minor cost issue, not worth failing an already-final request over.
async function cleanupBlob(statementId: string, blobUrl: string) {
  try {
    await deleteBlob(blobUrl);
    await prisma.statement.update({ where: { id: statementId }, data: { blobUrl: null } });
  } catch {
    /* best-effort */
  }
}

export async function POST(req: Request) {
  // (1a) SIGNATURE FIRST — verify against the RAW body before ANY work. Unverified => 401.
  // An unverified public worker endpoint lets anyone POST fake jobs and burn compute/LLM/DB.
  const signature = req.headers.get("upstash-signature") ?? "";
  const raw = await req.text();
  let verified = false;
  try {
    verified = await getQStashReceiver().verify({ signature, body: raw });
  } catch {
    verified = false; // missing keys or bad signature both mean "do not trust this request"
  }
  if (!verified) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Invalid signature." } }, { status: 401 });
  }

  // (1b) validate payload
  let statementId: string;
  let jobId: string;
  try {
    ({ statementId, jobId } = bodySchema.parse(JSON.parse(raw)));
  } catch {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid body." } }, { status: 400 });
  }

  // (1c) IDEMPOTENCY MARKER — atomic SET NX keyed by jobId. Of two *concurrent* deliveries only one
  // gets "OK"; the other gets null and skips. This closes the exact-concurrent race the check-then-
  // act DB status guard below can't win (it has a read→write gap). FAIL-OPEN: if Redis is down, we
  // fall through to the DB guard rather than hard-failing the worker. The marker is released in the
  // `finally` below so a legitimate retry (after a transient failure) can re-acquire immediately.
  let heldLock = false;
  try {
    const acquired = await getRedis().set(`${JOB_LOCK_PREFIX}${jobId}`, "1", {
      nx: true,
      ex: JOB_LOCK_TTL_SECONDS,
    });
    if (acquired === null) return ok(); // a concurrent delivery is already handling this job
    heldLock = true;
  } catch {
    heldLock = false; // Redis unavailable → rely on the DB status guard for the common-case dup
  }

  try {
    // Load the Statement. Not found => 200 (deleted; don't make QStash retry forever). There is NO
    // user session here (machine-to-machine); the QStash signature is the auth, and we operate only
    // on the verified statementId. userId lives on the row itself, not a session.
    const statement = await prisma.statement.findUnique({ where: { id: statementId } });
    if (!statement) return ok();

    // (2) IDEMPOTENCY: QStash is at-least-once. Only an UPLOADED statement is processable; anything
    // else (PROCESSING mid-flight / PROCESSED / FAILED) => skip, so double-delivery can't duplicate.
    if (statement.status !== "UPLOADED") return ok();

    // (3) mark PROCESSING + attempts++
    await prisma.$transaction([
      prisma.statement.update({ where: { id: statementId }, data: { status: "PROCESSING" } }),
      prisma.job.update({
        where: { statementId },
        data: { state: "PROCESSING", stage: "extract", attempts: { increment: 1 } },
      }),
    ]);

    // permanent: no blob to fetch
    if (!statement.blobUrl) {
      await prisma.$transaction([
        prisma.statement.update({ where: { id: statementId }, data: { status: "FAILED" } }),
        prisma.job.update({ where: { statementId }, data: { state: "FAILED", error: "missing_blob" } }),
      ]);
      return ok();
    }
    const blobUrl = statement.blobUrl;

    // TRANSIENT (network/storage blip): reset to UPLOADED so the retry re-enters past the guard,
    // record the failure on the Job, and return 500 so QStash retries. Do NOT delete the blob.
    let bytes: Uint8Array;
    try {
      bytes = await fetchStatementPdf(blobUrl);
    } catch {
      await prisma.$transaction([
        prisma.statement.update({ where: { id: statementId }, data: { status: "UPLOADED" } }),
        prisma.job.update({ where: { statementId }, data: { state: "FAILED", error: "blob_fetch_failed" } }),
      ]);
      return retry();
    }

    // PERMANENT (retry can't help): unreadable/scanned PDF. Mark FAILED, clean up, 200.
    let text: string;
    try {
      const extraction = await extractPdfText(bytes);
      if (!extraction.hasText) throw new Error("no_text");
      text = extraction.text;
    } catch (e) {
      const error = e instanceof Error && e.message === "no_text" ? "no_text" : "extract_failed";
      await prisma.$transaction([
        prisma.statement.update({ where: { id: statementId }, data: { status: "FAILED" } }),
        prisma.job.update({ where: { statementId }, data: { state: "FAILED", error } }),
      ]);
      await cleanupBlob(statementId, blobUrl);
      return ok();
    }

    // PERMANENT: nothing parseable in the (M2) supported format.
    const parsed = parseStatement(text);
    if (parsed.transactions.length === 0) {
      await prisma.$transaction([
        prisma.statement.update({ where: { id: statementId }, data: { status: "FAILED" } }),
        prisma.job.update({ where: { statementId }, data: { state: "FAILED", error: "no_transactions" } }),
      ]);
      await cleanupBlob(statementId, blobUrl);
      return ok();
    }

    // SUCCESS — atomic: insert txns + Statement PROCESSED + Job DONE. A DB blip here is TRANSIENT.
    try {
      await prisma.$transaction([
        prisma.transaction.createMany({
          data: parsed.transactions.map((t) => ({
            statementId,
            date: t.date,
            rawDescription: t.rawDescription,
            amount: t.amount,
          })),
        }),
        prisma.statement.update({ where: { id: statementId }, data: { status: "PROCESSED" } }),
        prisma.job.update({ where: { statementId }, data: { state: "DONE", stage: null, error: null } }),
      ]);
    } catch {
      await prisma.$transaction([
        prisma.statement.update({ where: { id: statementId }, data: { status: "UPLOADED" } }),
        prisma.job.update({ where: { statementId }, data: { state: "FAILED", error: "persist_failed" } }),
      ]);
      return retry();
    }

    await cleanupBlob(statementId, blobUrl); // minimize how long the financial PDF is stored
    return ok();
  } finally {
    // Release the marker on EVERY exit so a legitimate retry can re-acquire immediately. Best-effort
    // (a failed DEL just leaves the TTL to expire); only release if we actually acquired it.
    if (heldLock) {
      try {
        await getRedis().del(`${JOB_LOCK_PREFIX}${jobId}`);
      } catch {
        /* best-effort */
      }
    }
  }
}
