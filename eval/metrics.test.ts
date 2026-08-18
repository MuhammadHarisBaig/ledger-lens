import { describe, it, expect } from "vitest";
import { accuracy, perCategory, macroF1, confusionMatrix } from "./metrics";

describe("accuracy", () => {
  it("is the fraction of correctly-labeled items", () => {
    // pairs: A/A ✓, A/B ✗, B/B ✓, C/C ✓ → 3 of 4
    const predicted = ["A", "A", "B", "C"];
    const expected = ["A", "B", "B", "C"];
    expect(accuracy(predicted, expected)).toBe(0.75);
  });

  it("returns 0 for an empty set (no divide-by-zero)", () => {
    expect(accuracy([], [])).toBe(0);
  });
});

describe("perCategory", () => {
  it("computes precision/recall/f1/support per label", () => {
    // A: predicted 4× (idx 0,1,2,4), only idx 0,1 truly A → precision 2/4; truly-A = 2, both caught → recall 1
    // B: predicted 1× (idx 3), truly B → precision 1; truly-B = 2 (idx 3,4), caught 1 → recall 1/2
    // C: never predicted, truly C once (idx 2) → a real class with all-zero scores
    const predicted = ["A", "A", "A", "B", "A"];
    const expected = ["A", "A", "C", "B", "B"];
    const m = perCategory(predicted, expected);

    expect(m.A.precision).toBe(0.5);
    expect(m.A.recall).toBe(1);
    expect(m.A.support).toBe(2);

    expect(m.B.precision).toBe(1);
    expect(m.B.recall).toBe(0.5);
    expect(m.B.support).toBe(2);

    expect(m.C.support).toBe(1);
    expect(m.C.precision).toBe(0);
    expect(m.C.recall).toBe(0);
    expect(m.C.f1).toBe(0);
  });
});

describe("accuracy vs macro-F1 under class imbalance", () => {
  // The headline case: a dataset dominated by one class, model predicts ONLY that class.
  // 8×A + 1×B + 1×C expected; all-A predicted.
  const expected = [...Array(8).fill("A"), "B", "C"];
  const predicted = Array(10).fill("A");

  it("accuracy looks healthy (0.8) — the 8 A's carry it", () => {
    expect(accuracy(predicted, expected)).toBe(0.8);
  });

  it("macro-F1 is low (~0.30) — it exposes B and C being never right", () => {
    // A: precision 8/10, recall 1 → f1 ≈ 0.889; B & C: f1 = 0. mean ≈ 0.296.
    expect(macroF1(predicted, expected)).toBeCloseTo(0.2963, 3);
  });
});

describe("confusionMatrix", () => {
  it("counts matrix[actual][predicted]", () => {
    const predicted = ["A", "A", "B"];
    const expected = ["A", "B", "B"];
    const cm = confusionMatrix(predicted, expected);
    expect(cm.A.A).toBe(1); // one true-A predicted A (correct, on the diagonal)
    expect(cm.B.A).toBe(1); // one true-B predicted A (confused B → A)
    expect(cm.B.B).toBe(1); // one true-B predicted B (correct)
    expect(cm.A.B).toBe(0);
  });
});
