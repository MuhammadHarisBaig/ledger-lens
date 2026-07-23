import { describe, it, expect, vi, beforeEach } from "vitest";

const { getCurrentUser, getOwnedStatementStatus } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getOwnedStatementStatus: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ getCurrentUser }));
vi.mock("@/lib/statements", () => ({ getOwnedStatementStatus }));

import { GET } from "./route";

function statusRequest(id = "s1") {
  const req = new Request(`http://localhost:3000/api/statements/${id}/status`);
  return GET(req, { params: Promise.resolve({ id }) });
}

beforeEach(() => vi.clearAllMocks());

describe("GET /api/statements/[id]/status", () => {
  it("returns 401 when not signed in", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await statusRequest();
    expect(res.status).toBe(401);
    expect(getOwnedStatementStatus).not.toHaveBeenCalled();
  });

  // Ownership invariant: a non-owner's statement isn't found => 404, never revealed.
  it("returns 404 for a statement the user does not own", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-B" });
    getOwnedStatementStatus.mockResolvedValue(null);
    const res = await statusRequest();
    expect(res.status).toBe(404);
    expect(getOwnedStatementStatus).toHaveBeenCalledWith("user-B", "s1");
  });

  it("returns the status snapshot for the owner (no message on success)", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-A" });
    getOwnedStatementStatus.mockResolvedValue({
      status: "PROCESSED",
      job: { state: "DONE", error: null, attempts: 1 },
      _count: { transactions: 5 },
    });
    const res = await statusRequest();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      status: "PROCESSED",
      jobState: "DONE",
      transactionCount: 5,
      message: null,
    });
  });

  // A FAILED job returns a FRIENDLY message — never the raw internal reason code.
  it("maps a FAILED job to a friendly message, not the raw Job.error", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-A" });
    getOwnedStatementStatus.mockResolvedValue({
      status: "FAILED",
      job: { state: "FAILED", error: "extract_failed", attempts: 1 },
      _count: { transactions: 0 },
    });
    const res = await statusRequest();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("FAILED");
    expect(typeof body.message).toBe("string");
    expect(body.message.length).toBeGreaterThan(0);
    // the internal reason code must NOT leak to the client
    expect(JSON.stringify(body)).not.toContain("extract_failed");
    expect(body).not.toHaveProperty("error");
  });
});
