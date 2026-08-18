/**
 * Classification metrics — PURE functions (no I/O, no LLM, no dates/randomness), so they are
 * fully deterministic and unit-testable in CI. These measure the categorizer's OUTPUT; the LLM
 * itself is never called here. `metrics.test.ts` locks the math so the numbers `run.ts` prints
 * can be trusted.
 *
 * All functions operate on plain string labels and are computed over the UNION of labels that
 * appear in either `predicted` or `expected` — so a hallucinated label the model invents shows up
 * as its own class (with precision/recall/F1 of 0), correctly penalizing it rather than hiding it.
 *
 * Convention: `predicted[i]` is the model's label for the same item as `expected[i]`; the two
 * arrays must be the same length (the caller pairs them by index).
 */

// The set of all labels seen in either array — the class list every per-category metric ranges over.
function labelSet(predicted: string[], expected: string[]): string[] {
  return Array.from(new Set([...predicted, ...expected])).sort();
}

// Guard so a category with no predictions/no support yields 0 instead of NaN (0/0).
function safeDiv(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * accuracy — fraction of items labeled correctly overall.
 * Simple and intuitive, but can look high while a rare category is ALWAYS wrong (the big
 * categories carry it). That blind spot is exactly what macro-F1 exposes.
 */
export function accuracy(predicted: string[], expected: string[]): number {
  if (expected.length === 0) return 0;
  let correct = 0;
  for (let i = 0; i < expected.length; i++) {
    if (predicted[i] === expected[i]) correct++;
  }
  return correct / expected.length;
}

export type CategoryMetric = {
  precision: number;
  recall: number;
  f1: number;
  support: number; // how many items TRULY belong to this category (count in `expected`)
};

/**
 * Per-category precision / recall / F1 / support.
 *  - precision(c) = TP / (TP + FP) — of the items we CALLED c, how many really were c.
 *  - recall(c)    = TP / (TP + FN) — of the items that ARE c, how many we caught.
 *  - f1(c)        = harmonic mean of precision and recall (punishes a lopsided pair).
 *  - support(c)   = number of items whose true label is c (the denominator that weights nothing
 *                   in macro-F1 — every class counts equally regardless of support).
 */
export function perCategory(
  predicted: string[],
  expected: string[],
): Record<string, CategoryMetric> {
  const labels = labelSet(predicted, expected);
  const result: Record<string, CategoryMetric> = {};

  for (const label of labels) {
    let tp = 0;
    let fp = 0;
    let fn = 0;
    for (let i = 0; i < expected.length; i++) {
      const isPred = predicted[i] === label;
      const isTrue = expected[i] === label;
      if (isPred && isTrue) tp++;
      else if (isPred && !isTrue) fp++;
      else if (!isPred && isTrue) fn++;
    }
    const precision = safeDiv(tp, tp + fp);
    const recall = safeDiv(tp, tp + fn);
    const f1 = safeDiv(2 * precision * recall, precision + recall);
    result[label] = { precision, recall, f1, support: tp + fn };
  }
  return result;
}

/**
 * macro-F1 — the UNWEIGHTED mean of per-category F1 across all labels.
 *
 * Why it matters under class imbalance: because every category contributes equally (not weighted
 * by how common it is), a category the model always gets wrong drags macro-F1 down even when
 * overall accuracy stays high on the dominant categories. It answers "is the model good at EVERY
 * category?" rather than "is it good on average per transaction?".
 */
export function macroF1(predicted: string[], expected: string[]): number {
  const perCat = perCategory(predicted, expected);
  const labels = Object.keys(perCat);
  if (labels.length === 0) return 0;
  const sum = labels.reduce((acc, label) => acc + perCat[label].f1, 0);
  return sum / labels.length;
}

/**
 * confusionMatrix[actual][predicted] = count.
 * Read a row to see how a true category was distributed across predictions: the diagonal is
 * correct, off-diagonal cells show exactly which wrong label the model confused it with.
 */
export function confusionMatrix(
  predicted: string[],
  expected: string[],
): Record<string, Record<string, number>> {
  const labels = labelSet(predicted, expected);
  const matrix: Record<string, Record<string, number>> = {};
  for (const actual of labels) {
    matrix[actual] = {};
    for (const pred of labels) matrix[actual][pred] = 0;
  }
  for (let i = 0; i < expected.length; i++) {
    const actual = expected[i];
    const pred = predicted[i];
    // both are guaranteed present in `labels` since it's the union of the two arrays
    matrix[actual][pred] += 1;
  }
  return matrix;
}
