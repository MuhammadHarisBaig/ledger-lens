import { describe, it, expect } from "vitest";
import { isTerminalStatus } from "./pollStatus";

describe("isTerminalStatus (should-we-stop-polling decision)", () => {
  it("is terminal for PROCESSED and FAILED", () => {
    expect(isTerminalStatus("PROCESSED")).toBe(true);
    expect(isTerminalStatus("FAILED")).toBe(true);
  });

  it("is NOT terminal for in-flight states", () => {
    expect(isTerminalStatus("UPLOADED")).toBe(false);
    expect(isTerminalStatus("PROCESSING")).toBe(false);
  });
});
