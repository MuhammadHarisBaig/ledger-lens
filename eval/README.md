# LedgerLens — LLM evaluation harness

This directory measures how well the transaction categorizer (`src/lib/categorize.ts`, backed by
Gemini) assigns transactions to the fixed `TransactionCategory` taxonomy.

## What's here

- **`dataset.ts`** — ~40 **synthetic** labeled examples (`rawDescription` + `amount` +
  `expectedCategory`). ⚠️ **All merchants are invented; there is no real personal or financial
  data.** It is fabricated ground truth, deliberately spanning every category (including `INCOME`)
  and several genuinely ambiguous descriptions.
- **`metrics.ts`** — pure, deterministic scoring functions: `accuracy`, per-category
  `perCategory` (precision / recall / F1 / support), `macroF1`, and `confusionMatrix`. No I/O, no
  LLM — safe and fast to unit-test.
- **`metrics.test.ts`** — unit tests for the metric MATH (runs in CI). It asserts a case where
  accuracy looks healthy (0.8) but macro-F1 is low (~0.30), proving macro-F1 exposes categories a
  high accuracy can hide.
- **`run.ts`** — the offline runner. Makes a **real** batched Gemini call over the dataset, scores
  it, and writes `report.md`.
- **`report.md`** — generated output (model, schema version, date, N, accuracy, macro-F1,
  per-category table, confusion matrix, and latency/token/cost observability).

## Why the runner is offline and NOT in CI

`run.ts` calls the real LLM, which **costs money/quota** and is **non-deterministic** — the opposite
of what a fast, hermetic CI gate needs. So the split is deliberate:

- **CI** runs `metrics.test.ts` only — pure math, no network, no keys. It guarantees the numbers the
  report prints are computed correctly.
- **The eval** (`run.ts`) is a manual, on-demand run that produces `report.md`. The LLM is the thing
  being *measured*, not gated.

## Running it

Requires a real `GEMINI_API_KEY` in `.env.local`.

```bash
npm run eval
```

This loads `.env.local` (via `dotenv-cli`) and runs `run.ts` (via `tsx`), regenerating `report.md`.

## Reading the report

- **Accuracy** — fraction of transactions labeled correctly overall.
- **Macro-F1** — unweighted mean of per-category F1; the honest headline under class imbalance.
  Rough bands on this small synthetic set: **≥ 0.80** strong, **0.60–0.80** decent with clear weak
  spots, **< 0.60** concerning (look at which categories collapse).
- **Per-category table** — find low **recall** (the model misses that category) vs low **precision**
  (it over-assigns that category). Ambiguous descriptions are the usual culprits.
- **Confusion matrix** — scan each actual row: the diagonal is correct; the biggest off-diagonal
  cell tells you exactly which category it gets confused with (e.g. `DINING → GROCERIES`).

`report.md` is safe to commit because the dataset is synthetic (no PII).
