import { describe, it, expect, vi } from "vitest";
import { pollUntilTerminal, type StatusSnapshot } from "./pollStatus";

const snap = (status: string, transactionCount = 0): StatusSnapshot => ({
  status,
  transactionCount,
  error: null,
});
const noSleep = () => Promise.resolve();

describe("pollUntilTerminal", () => {
  it("polls until a terminal state and returns that snapshot", async () => {
    const fetchStatus = vi
      .fn<() => Promise<StatusSnapshot>>()
      .mockResolvedValueOnce(snap("PROCESSING"))
      .mockResolvedValueOnce(snap("PROCESSING"))
      .mockResolvedValueOnce(snap("PROCESSED", 5));

    const result = await pollUntilTerminal(fetchStatus, { sleep: noSleep });

    expect(result).toEqual({ status: "PROCESSED", transactionCount: 5, error: null });
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });

  it("treats FAILED as terminal", async () => {
    const fetchStatus = vi.fn<() => Promise<StatusSnapshot>>().mockResolvedValue({
      status: "FAILED",
      transactionCount: 0,
      error: "no_transactions",
    });
    const result = await pollUntilTerminal(fetchStatus, { sleep: noSleep });
    expect(result?.status).toBe("FAILED");
    expect(result?.error).toBe("no_transactions");
  });

  it("returns null (timeout) if it never reaches a terminal state", async () => {
    const fetchStatus = vi.fn<() => Promise<StatusSnapshot>>().mockResolvedValue(snap("PROCESSING"));
    const result = await pollUntilTerminal(fetchStatus, { sleep: noSleep, maxAttempts: 3 });
    expect(result).toBeNull();
    expect(fetchStatus).toHaveBeenCalledTimes(3);
  });
});
