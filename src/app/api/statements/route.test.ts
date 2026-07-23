import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock every external boundary so the handler runs with NO real creds/DB.
// vi.hoisted keeps the spies available inside the hoisted vi.mock factories.
const {
  getCurrentUser,
  publishJSON,
  limit,
  putStatementPdf,
  deleteBlob,
  statementCreate,
  jobCreate,
  prismaMock,
} = vi.hoisted(() => {
  const statementCreate = vi.fn();
  const jobCreate = vi.fn();
  return {
    getCurrentUser: vi.fn(),
    publishJSON: vi.fn(),
    limit: vi.fn(),
    putStatementPdf: vi.fn(),
    deleteBlob: vi.fn(),
    statementCreate,
    jobCreate,
    prismaMock: {
      statement: { findUnique: vi.fn(), update: vi.fn() },
      job: { update: vi.fn() },
      transaction: { count: vi.fn() },
      $transaction: vi.fn(),
    },
  };
});

vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/qstash", () => ({ getQStashClient: () => ({ publishJSON }) }));
vi.mock("@/lib/rateLimit", () => ({ getUploadLimiter: () => ({ limit }) }));
vi.mock("@/lib/blob", () => ({ putStatementPdf, deleteBlob }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "./route";

const BLOB_URL = "https://blob.example/statements/statement.pdf-abc123.pdf";

function uploadRequest() {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a, 0x31]); // "%PDF\n1"
  const fd = new FormData();
  fd.append("file", new File([bytes], "statement.pdf", { type: "application/pdf" }));
  return new Request("http://localhost:3000/api/statements", { method: "POST", body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user-1" });
  limit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 });
  putStatementPdf.mockResolvedValue({ url: BLOB_URL, pathname: "statements/statement.pdf-abc123.pdf" });
  statementCreate.mockResolvedValue({ id: "s1", status: "UPLOADED" });
  jobCreate.mockResolvedValue({ id: "j1", state: "QUEUED" });
  // Interactive $transaction(cb) => create Statement then Job; array form => Promise.all.
  prismaMock.$transaction.mockImplementation(async (arg) => {
    if (typeof arg === "function") {
      return arg({ statement: { create: statementCreate }, job: { create: jobCreate } });
    }
    return Promise.all(arg);
  });
});

describe("POST /api/statements (blob storage + enqueue)", () => {
  it("new upload: stores blob, saves blobUrl, publishes ids-only, returns 202", async () => {
    prismaMock.statement.findUnique.mockResolvedValue(null);
    publishJSON.mockResolvedValue({ messageId: "m1" });

    const res = await POST(uploadRequest());

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ statementId: "s1", jobId: "j1", status: "queued" });

    // PDF stored exactly once, and the blob URL is persisted on the Statement row.
    expect(putStatementPdf).toHaveBeenCalledTimes(1);
    expect(statementCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "UPLOADED", blobUrl: BLOB_URL }),
    });

    // SECURITY: the queue message carries ONLY identifiers — never the blob url / bytes / text.
    expect(publishJSON).toHaveBeenCalledTimes(1);
    const payload = publishJSON.mock.calls[0][0];
    expect(payload.body).toEqual({ statementId: "s1", jobId: "j1" });
    expect(payload.body).not.toHaveProperty("blobUrl");
    expect(payload.body).not.toHaveProperty("url");
  });

  it("duplicate upload: does NOT store a blob or enqueue, returns existing summary", async () => {
    prismaMock.statement.findUnique.mockResolvedValue({ id: "s1", status: "PROCESSED" });
    prismaMock.transaction.count.mockResolvedValue(5);

    const res = await POST(uploadRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ statementId: "s1", status: "PROCESSED", transactionCount: 5 });
    expect(putStatementPdf).not.toHaveBeenCalled();
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it("publish failure: marks Job+Statement FAILED and deletes the blob (no orphan)", async () => {
    prismaMock.statement.findUnique.mockResolvedValue(null);
    publishJSON.mockRejectedValue(new Error("qstash unreachable"));

    const res = await POST(uploadRequest());

    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: "ENQUEUE_FAILED" } });
    expect(prismaMock.job.update).toHaveBeenCalledWith({
      where: { id: "j1" },
      data: { state: "FAILED", error: "enqueue_failed" },
    });
    expect(prismaMock.statement.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { status: "FAILED" },
    });
    expect(deleteBlob).toHaveBeenCalledWith(BLOB_URL);
  });

  it("over rate limit: 429 and NO blob store / DB write / enqueue (checked before expensive work)", async () => {
    limit.mockResolvedValue({ success: false, limit: 10, remaining: 0, reset: Date.now() + 30_000 });

    const res = await POST(uploadRequest());

    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    // Proves the limit is enforced BEFORE any side-effecting/expensive work.
    expect(putStatementPdf).not.toHaveBeenCalled();
    expect(prismaMock.statement.findUnique).not.toHaveBeenCalled();
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it("rate limiter unavailable (Redis down): fails open and allows the upload", async () => {
    limit.mockRejectedValue(new Error("redis unavailable"));
    prismaMock.statement.findUnique.mockResolvedValue(null);
    publishJSON.mockResolvedValue({ messageId: "m1" });

    const res = await POST(uploadRequest());

    expect(res.status).toBe(202);
    expect(putStatementPdf).toHaveBeenCalledTimes(1);
    expect(publishJSON).toHaveBeenCalledTimes(1);
  });
});
