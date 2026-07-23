import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock every boundary so the worker runs credential-free. vi.hoisted keeps spies available
// inside the hoisted vi.mock factories.
const { verify, redisSet, redisDel, fetchStatementPdf, deleteBlob, extractPdfText, parseStatement, prismaMock } =
  vi.hoisted(() => ({
    verify: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
    fetchStatementPdf: vi.fn(),
    deleteBlob: vi.fn(),
    extractPdfText: vi.fn(),
    parseStatement: vi.fn(),
    prismaMock: {
      statement: { findUnique: vi.fn(), update: vi.fn() },
      job: { update: vi.fn() },
      transaction: { createMany: vi.fn() },
      $transaction: vi.fn(),
    },
  }));

vi.mock("@/lib/qstash", () => ({ getQStashReceiver: () => ({ verify }) }));
vi.mock("@/lib/redis", () => ({ getRedis: () => ({ set: redisSet, del: redisDel }) }));
vi.mock("@/lib/blob", () => ({ fetchStatementPdf, deleteBlob }));
vi.mock("@/lib/extractPdfText", () => ({ extractPdfText }));
vi.mock("@/lib/parseStatement", () => ({ parseStatement }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function workerRequest(body: unknown = { statementId: "s1", jobId: "j1" }) {
  return new Request("http://localhost:3000/api/worker/process", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "upstash-signature": "sig", "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.$transaction.mockImplementation(async (arg) => Promise.all(arg));
  redisSet.mockResolvedValue("OK"); // default: dedup marker acquired
  redisDel.mockResolvedValue(1);
});

describe("POST /api/worker/process", () => {
  it("rejects an invalid signature with 401 and does NO work", async () => {
    verify.mockResolvedValue(false);

    const res = await POST(workerRequest());

    expect(res.status).toBe(401);
    // The security gate must run before anything else — no DB read, no processing.
    expect(prismaMock.statement.findUnique).not.toHaveBeenCalled();
    expect(fetchStatementPdf).not.toHaveBeenCalled();
  });

  it("processes an UPLOADED statement: inserts txns, PROCESSED, Job DONE, deletes blob, nulls blobUrl", async () => {
    verify.mockResolvedValue(true);
    prismaMock.statement.findUnique.mockResolvedValue({ id: "s1", status: "UPLOADED", blobUrl: "blob://x" });
    fetchStatementPdf.mockResolvedValue(new Uint8Array([0x25]));
    extractPdfText.mockResolvedValue({ text: "some text", hasText: true, pageCount: 1 });
    parseStatement.mockReturnValue({
      transactions: [{ date: new Date("2024-01-05T00:00:00Z"), rawDescription: "STARBUCKS", amount: -5.5 }],
      skippedLines: 2,
    });

    const res = await POST(workerRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.transaction.createMany).toHaveBeenCalledWith({
      data: [{ statementId: "s1", date: expect.any(Date), rawDescription: "STARBUCKS", amount: -5.5 }],
    });
    expect(prismaMock.statement.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { status: "PROCESSED" } });
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { statementId: "s1" },
      data: { state: "DONE", stage: null, error: null },
    });
    expect(deleteBlob).toHaveBeenCalledWith("blob://x");
    expect(prismaMock.statement.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { blobUrl: null } });
  });

  it("skips an already-PROCESSED statement (double delivery): 200, no reprocessing", async () => {
    verify.mockResolvedValue(true);
    prismaMock.statement.findUnique.mockResolvedValue({ id: "s1", status: "PROCESSED", blobUrl: null });

    const res = await POST(workerRequest());

    expect(res.status).toBe(200);
    expect(fetchStatementPdf).not.toHaveBeenCalled();
    expect(extractPdfText).not.toHaveBeenCalled();
    expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it("permanent failure (0 transactions): FAILED + 200 (no retry) + blob cleaned up", async () => {
    verify.mockResolvedValue(true);
    prismaMock.statement.findUnique.mockResolvedValue({ id: "s1", status: "UPLOADED", blobUrl: "blob://x" });
    fetchStatementPdf.mockResolvedValue(new Uint8Array([0x25]));
    extractPdfText.mockResolvedValue({ text: "junk only", hasText: true, pageCount: 1 });
    parseStatement.mockReturnValue({ transactions: [], skippedLines: 3 });

    const res = await POST(workerRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { statementId: "s1" },
      data: { state: "FAILED", error: "no_transactions" },
    });
    expect(deleteBlob).toHaveBeenCalledWith("blob://x");
  });

  it("transient failure (blob fetch throws): resets to UPLOADED, Job FAILED, 500 (retry), keeps blob", async () => {
    verify.mockResolvedValue(true);
    prismaMock.statement.findUnique.mockResolvedValue({ id: "s1", status: "UPLOADED", blobUrl: "blob://x" });
    fetchStatementPdf.mockRejectedValue(new Error("network blip"));

    const res = await POST(workerRequest());

    expect(res.status).toBe(500);
    expect(prismaMock.statement.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { status: "UPLOADED" } });
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { statementId: "s1" },
      data: { state: "FAILED", error: "blob_fetch_failed" },
    });
    expect(deleteBlob).not.toHaveBeenCalled(); // retry needs the blob
  });

  it("concurrent double-delivery (Redis marker already held): 200, skipped, no processing", async () => {
    verify.mockResolvedValue(true);
    redisSet.mockResolvedValue(null); // another concurrent delivery got the marker first

    const res = await POST(workerRequest());

    expect(res.status).toBe(200);
    // Sealed before any DB read/work — this is what the atomic SET NX adds over the DB guard.
    expect(prismaMock.statement.findUnique).not.toHaveBeenCalled();
    expect(prismaMock.transaction.createMany).not.toHaveBeenCalled();
  });

  it("Redis down at marker acquire: fails open, still processes once via the DB guard", async () => {
    verify.mockResolvedValue(true);
    redisSet.mockRejectedValue(new Error("redis unavailable"));
    prismaMock.statement.findUnique.mockResolvedValue({ id: "s1", status: "UPLOADED", blobUrl: "blob://x" });
    fetchStatementPdf.mockResolvedValue(new Uint8Array([0x25]));
    extractPdfText.mockResolvedValue({ text: "some text", hasText: true, pageCount: 1 });
    parseStatement.mockReturnValue({
      transactions: [{ date: new Date("2024-02-03T00:00:00Z"), rawDescription: "UBER", amount: -18.75 }],
      skippedLines: 1,
    });

    const res = await POST(workerRequest());

    expect(res.status).toBe(200);
    expect(prismaMock.transaction.createMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.statement.update).toHaveBeenCalledWith({ where: { id: "s1" }, data: { status: "PROCESSED" } });
  });
});
