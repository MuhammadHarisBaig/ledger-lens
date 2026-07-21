import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the three external boundaries so the handler runs with NO real creds/DB.
// vi.hoisted keeps the spies available inside the hoisted vi.mock factories.
const { getCurrentUser, publishJSON, prismaMock } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  publishJSON: vi.fn(),
  prismaMock: {
    statement: { findUnique: vi.fn(), update: vi.fn() },
    job: { update: vi.fn() },
    transaction: { count: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/qstash", () => ({ getQStashClient: () => ({ publishJSON }) }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "./route";

function uploadRequest() {
  const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x0a, 0x31]); // "%PDF\n1"
  const fd = new FormData();
  fd.append("file", new File([bytes], "statement.pdf", { type: "application/pdf" }));
  return new Request("http://localhost:3000/api/statements", { method: "POST", body: fd });
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUser.mockResolvedValue({ id: "user-1" });
  // Interactive $transaction(cb) => create Statement then Job; array form => Promise.all.
  prismaMock.$transaction.mockImplementation(async (arg) => {
    if (typeof arg === "function") {
      return arg({
        statement: { create: vi.fn().mockResolvedValue({ id: "s1", status: "UPLOADED" }) },
        job: { create: vi.fn().mockResolvedValue({ id: "j1", state: "QUEUED" }) },
      });
    }
    return Promise.all(arg);
  });
});

describe("POST /api/statements (enqueue-only)", () => {
  it("new upload: creates Statement+Job, publishes ids-only, returns 202", async () => {
    prismaMock.statement.findUnique.mockResolvedValue(null);
    publishJSON.mockResolvedValue({ messageId: "m1" });

    const res = await POST(uploadRequest());

    expect(res.status).toBe(202);
    expect(await res.json()).toEqual({ statementId: "s1", jobId: "j1", status: "queued" });

    expect(publishJSON).toHaveBeenCalledTimes(1);
    const payload = publishJSON.mock.calls[0][0];
    // SECURITY + CORRECTNESS: the queue message carries ONLY identifiers — no bytes/text/file.
    expect(payload.body).toEqual({ statementId: "s1", jobId: "j1" });
    expect(Object.keys(payload.body).sort()).toEqual(["jobId", "statementId"]);
  });

  it("duplicate upload: returns existing summary and does NOT enqueue", async () => {
    prismaMock.statement.findUnique.mockResolvedValue({ id: "s1", status: "PROCESSED" });
    prismaMock.transaction.count.mockResolvedValue(5);

    const res = await POST(uploadRequest());

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ statementId: "s1", status: "PROCESSED", transactionCount: 5 });
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it("publish failure: marks Job+Statement FAILED and returns 502", async () => {
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
  });
});
