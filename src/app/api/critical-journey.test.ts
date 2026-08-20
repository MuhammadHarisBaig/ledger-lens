import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CRITICAL-JOURNEY integration test — the single highest-value test in the suite.
 *
 * It drives the whole money path across BOTH handlers that carry the product's value:
 *   POST /api/statements  (upload → store blob → create rows → enqueue ids)
 *   POST /api/worker/process  (verify → fetch → extract → parse → categorize → persist)
 *
 * The two handlers are linked by a SHARED in-memory Prisma mock, and the worker is invoked with the
 * EXACT { statementId, jobId } the upload published — so this proves the real handoff, not two
 * handlers tested in isolation. External boundaries (auth, QStash, Redis, Blob, unpdf, parser,
 * Gemini) are mocked, so it's deterministic and needs no credentials.
 *
 * Why this is the highest-value single test: it asserts the *persisted* result — that the categories
 * the model returned land on the right transaction rows and the statement ends PROCESSED. That's the
 * exact class of bug ("compute the categories but don't save them", or ids not flowing between the
 * upload and the worker) that unit-testing each handler alone would miss.
 */

const {
  getCurrentUser,
  publishJSON,
  limit,
  putStatementPdf,
  fetchStatementPdf,
  deleteBlob,
  extractPdfText,
  parseStatement,
  categorizeTransactions,
  verify,
  redisSet,
  redisDel,
  prisma,
  store,
} = vi.hoisted(() => {
  // Minimal in-memory Prisma backing both handlers, so the row the upload creates is the row the
  // worker reads/updates.
  const statements = new Map<string, Record<string, unknown>>();
  const jobs = new Map<string, Record<string, unknown>>(); // keyed by statementId
  const transactions: Record<string, unknown>[] = [];
  let sN = 0;
  let jN = 0;

  const db = {
    statement: {
      findUnique: async ({ where }: { where: Record<string, { userId?: string; contentHash?: string }> & { id?: string } }) => {
        if (where.id) return statements.get(where.id) ?? null;
        const key = where.userId_contentHash;
        if (key) {
          for (const s of statements.values()) {
            if (s.userId === key.userId && s.contentHash === key.contentHash) return s;
          }
        }
        return null;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `s${++sN}`;
        const row = { id, status: "UPLOADED", blobUrl: null, ...data };
        statements.set(id, row);
        return row;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = statements.get(where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    job: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const id = `j${++jN}`;
        const row = { id, ...data };
        jobs.set(data.statementId as string, row);
        return row;
      },
      update: async ({ where, data }: { where: { statementId?: string; id?: string }; data: Record<string, unknown> }) => {
        const row = where.statementId
          ? jobs.get(where.statementId)!
          : [...jobs.values()].find((j) => j.id === where.id)!;
        Object.assign(row, data);
        return row;
      },
    },
    transaction: {
      createMany: async ({ data }: { data: Record<string, unknown>[] }) => {
        transactions.push(...data);
        return { count: data.length };
      },
      count: async ({ where }: { where: { statementId: string } }) =>
        transactions.filter((t) => t.statementId === where.statementId).length,
    },
    // interactive form: call the callback with this same db; array form: await all.
    $transaction: async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: unknown) => unknown)(db) : Promise.all(arg as Promise<unknown>[]),
  };

  return {
    getCurrentUser: vi.fn(),
    publishJSON: vi.fn(),
    limit: vi.fn(),
    putStatementPdf: vi.fn(),
    fetchStatementPdf: vi.fn(),
    deleteBlob: vi.fn(),
    extractPdfText: vi.fn(),
    parseStatement: vi.fn(),
    categorizeTransactions: vi.fn(),
    verify: vi.fn(),
    redisSet: vi.fn(),
    redisDel: vi.fn(),
    prisma: db,
    store: { statements, jobs, transactions },
  };
});

vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/qstash", () => ({
  getQStashClient: () => ({ publishJSON }),
  getQStashReceiver: () => ({ verify }),
}));
vi.mock("@/lib/rateLimit", () => ({ getUploadLimiter: () => ({ limit }) }));
vi.mock("@/lib/redis", () => ({ getRedis: () => ({ set: redisSet, del: redisDel }) }));
vi.mock("@/lib/blob", () => ({ putStatementPdf, fetchStatementPdf, deleteBlob }));
vi.mock("@/lib/extractPdfText", () => ({ extractPdfText }));
vi.mock("@/lib/parseStatement", () => ({ parseStatement }));
vi.mock("@/lib/categorize", () => ({ categorizeTransactions }));
vi.mock("@/lib/prisma", () => ({ prisma }));

import { POST as uploadPOST } from "./statements/route";
import { POST as workerPOST } from "./worker/process/route";

const BLOB_URL = "https://blob.example/statements/statement.pdf-abc123.pdf";
// The two parsed transactions and the categories the (mocked) model assigns them, by index.
const PARSED = [
  { date: new Date("2024-01-05T00:00:00Z"), rawDescription: "STARBUCKS", amount: -5.5 },
  { date: new Date("2024-01-06T00:00:00Z"), rawDescription: "ACME PAYROLL", amount: 2000 },
];
const CATEGORIES = ["DINING", "INCOME"];

function uploadRequest() {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a, 0x31]); // "%PDF\n1"
  const fd = new FormData();
  fd.append("file", new File([bytes], "statement.pdf", { type: "application/pdf" }));
  return new Request("http://localhost:3000/api/statements", { method: "POST", body: fd });
}

function workerRequest(body: unknown) {
  return new Request("http://localhost:3000/api/worker/process", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "upstash-signature": "sig", "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  store.statements.clear();
  store.jobs.clear();
  store.transactions.length = 0;

  getCurrentUser.mockResolvedValue({ id: "user-1" });
  limit.mockResolvedValue({ success: true, limit: 10, remaining: 9, reset: Date.now() + 60_000 });
  putStatementPdf.mockResolvedValue({ url: BLOB_URL, pathname: "statements/statement.pdf-abc123.pdf" });
  publishJSON.mockResolvedValue({ messageId: "m1" });

  verify.mockResolvedValue(true);
  redisSet.mockResolvedValue("OK");
  redisDel.mockResolvedValue(1);
  fetchStatementPdf.mockResolvedValue(new Uint8Array([0x25, 0x50, 0x44, 0x46]));
  extractPdfText.mockResolvedValue({ text: "…statement text…", hasText: true, pageCount: 1 });
  parseStatement.mockReturnValue({ transactions: PARSED, skippedLines: 0 });
  categorizeTransactions.mockResolvedValue({ categories: CATEGORIES, metrics: { latencyMs: 1, schemaVersion: 1 } });
});

describe("critical journey: upload → worker → categorized + PROCESSED", () => {
  it("persists transactions WITH their categories and marks the statement PROCESSED", async () => {
    // 1) UPLOAD — accepted for async processing; publishes ids only.
    const uploadRes = await uploadPOST(uploadRequest());
    expect(uploadRes.status).toBe(202);
    const enqueued = publishJSON.mock.calls[0][0].body as { statementId: string; jobId: string };
    expect(enqueued).toEqual({ statementId: "s1", jobId: "j1" }); // ids only — no blobUrl/bytes
    expect(store.statements.get("s1")).toMatchObject({ status: "UPLOADED", blobUrl: BLOB_URL });

    // 2) WORKER — invoked with the EXACT ids the upload enqueued.
    const workerRes = await workerPOST(workerRequest(enqueued));
    expect(workerRes.status).toBe(200);

    // 3) The categories the model returned landed on the RIGHT rows (mapped by index), and the
    //    statement/job reached their terminal success states.
    expect(store.transactions).toEqual([
      { statementId: "s1", date: PARSED[0].date, rawDescription: "STARBUCKS", amount: -5.5, category: "DINING" },
      { statementId: "s1", date: PARSED[1].date, rawDescription: "ACME PAYROLL", amount: 2000, category: "INCOME" },
    ]);
    expect(store.statements.get("s1")).toMatchObject({ status: "PROCESSED", blobUrl: null });
    expect(store.jobs.get("s1")).toMatchObject({ state: "DONE" });

    // and the worker cleaned up the blob after the terminal outcome.
    expect(deleteBlob).toHaveBeenCalledWith(BLOB_URL);
  });
});
