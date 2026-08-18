import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Mock the Gemini SDK so tests run with no real key/network.
const { generateContent } = vi.hoisted(() => ({ generateContent: vi.fn() }));
vi.mock("@google/genai", () => ({
  // `new GoogleGenAI(...)` needs a constructable mock — a class (arrow fns aren't newable).
  GoogleGenAI: class {
    models = { generateContent };
  },
}));

import { categorizeTransactions } from "./categorize";

const txns = [
  { date: new Date("2024-01-01"), rawDescription: "WHOLE FOODS", amount: -30 },
  { date: new Date("2024-01-02"), rawDescription: "ACME PAYROLL", amount: 2000 },
];

const originalKey = process.env.GEMINI_API_KEY;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.GEMINI_API_KEY = "test-key"; // getGeminiClient reads this (SDK is mocked)
});
afterAll(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
});

describe("categorizeTransactions", () => {
  it("maps a valid response to categories in ONE batched call, with metrics", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify([
        { index: 0, category: "GROCERIES" },
        { index: 1, category: "INCOME" },
      ]),
      usageMetadata: { promptTokenCount: 120, candidatesTokenCount: 15, totalTokenCount: 135 },
    });

    const { categories, metrics } = await categorizeTransactions(txns);

    expect(categories).toEqual(["GROCERIES", "INCOME"]);
    // ONE call carrying ALL transactions (batched — not one call per transaction).
    expect(generateContent).toHaveBeenCalledTimes(1);
    const prompt = generateContent.mock.calls[0][0].contents as string;
    expect(prompt).toContain("WHOLE FOODS");
    expect(prompt).toContain("ACME PAYROLL");
    expect(metrics.totalTokens).toBe(135);
    expect(metrics.costEstimateUsd).toBeGreaterThan(0);
    expect(metrics.schemaVersion).toBe(1);
  });

  // THE key robustness test: bad model output must never crash the pipeline.
  it("defaults to OTHER on malformed JSON and never throws", async () => {
    generateContent.mockResolvedValue({ text: "not json {", usageMetadata: undefined });
    const { categories } = await categorizeTransactions(txns);
    expect(categories).toEqual(["OTHER", "OTHER"]);
  });

  it("defaults invalid categories and missing entries to OTHER", async () => {
    generateContent.mockResolvedValue({
      text: JSON.stringify([{ index: 0, category: "NONSENSE" }]), // invalid cat; index 1 absent
      usageMetadata: undefined,
    });
    const { categories } = await categorizeTransactions(txns);
    expect(categories).toEqual(["OTHER", "OTHER"]);
  });
});
