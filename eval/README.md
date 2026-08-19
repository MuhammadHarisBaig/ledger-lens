# LedgerLens — LLM evaluation harness

This directory measures how well the transaction categorizer (`src/lib/categorize.ts`, backed by
Gemini) assigns transactions to the fixed `TransactionCategory` taxonomy.

## What's here

- **`dataset.ts`** — ~60 **synthetic** labeled examples (`rawDescription` + `amount` +
  `expectedCategory`). ⚠️ **All merchants are invented; there is no real personal or financial
  data.** It is fabricated ground truth, spanning every category (including `INCOME`) and — since
  5A.1 — ~20 deliberately **adversarial** cases: payment-aggregator strings (`SQ *`, `PAYPAL *`,
  `SP *`) that hide the merchant, big-box stores that could be `GROCERIES` or `OTHER`, gas-station
  convenience buys, cryptic POS codes, refunds (money in but not income), a fee dressed as a
  purchase, and the `UBER` vs `UBER EATS` trap.

  **Why a discriminating eval needs failable cases:** a metric only measures what its inputs can
  distinguish. If every example is unambiguous, any competent model scores ~100% and the number
  can't separate a strong model from a weak one, catch a regression, or justify a cost/quality
  tradeoff. The adversarial rows sit at the real decision boundary, giving macro-F1 room to move.
- **`metrics.ts`** — pure, deterministic scoring functions: `accuracy`, per-category
  `perCategory` (precision / recall / F1 / support), `macroF1`, and `confusionMatrix`. No I/O, no
  LLM — safe and fast to unit-test.
- **`metrics.test.ts`** — unit tests for the metric MATH (runs in CI). It asserts a case where
  accuracy looks healthy (0.8) but macro-F1 is low (~0.30), proving macro-F1 exposes categories a
  high accuracy can hide.
- **`run.ts`** — the offline runner. Makes a **real** batched Gemini call over the dataset, scores
  it, and writes a report. Supports a **thinking ON/OFF** comparison (see below).
- **`report.md`** / **`report-nothinking.md`** — generated output (model, thinking mode, schema
  version, date, N, accuracy, macro-F1, per-category table, confusion matrix, and latency/token/cost
  observability). Thinking ON writes `report.md`; OFF writes `report-nothinking.md`.

## Why the runner is offline and NOT in CI

`run.ts` calls the real LLM, which **costs money/quota** and is **non-deterministic** — the opposite
of what a fast, hermetic CI gate needs. So the split is deliberate:

- **CI** runs `metrics.test.ts` only — pure math, no network, no keys. It guarantees the numbers the
  report prints are computed correctly.
- **The eval** (`run.ts`) is a manual, on-demand run that produces `report.md`. The LLM is the thing
  being *measured*, not gated.

## Running it

Requires a real `GEMINI_API_KEY` in `.env.local`. Both commands load `.env.local` (via `dotenv-cli`)
and run `run.ts` (via `tsx`).

```bash
npm run eval            # thinking ON  → eval/report.md
npm run eval:nothink    # thinking OFF (thinkingBudget 0) → eval/report-nothinking.md
```

### Thinking ON vs OFF — a measured decision, not a guess

`gemini-2.5-flash` "thinks" by default, spending extra **thinking (thoughts) tokens** that bill at
the OUTPUT rate. `eval:nothink` disables that (`thinkingBudget: 0`) and runs the **same** hardened
dataset, so you can compare macro-F1, cost, and latency side by side and let the numbers — not a
hunch — decide whether thinking is worth it for this classifier. The default worker behavior is
unchanged; the eval only informs the choice.

**Cost fix (5A.1):** cost now counts **billable output = total − prompt** (candidates *plus*
thinking), not candidates alone. Before this, thinking tokens were silently excluded and the cost
was understated by more than half.

## Reading the report

- **Accuracy** — fraction of transactions labeled correctly overall.
- **Macro-F1** — unweighted mean of per-category F1; the honest headline under class imbalance.
  Rough bands on this small synthetic set: **≥ 0.80** strong, **0.60–0.80** decent with clear weak
  spots, **< 0.60** concerning (look at which categories collapse).
- **Per-category table** — find low **recall** (the model misses that category) vs low **precision**
  (it over-assigns that category). Ambiguous descriptions are the usual culprits.
- **Confusion matrix** — scan each actual row: the diagonal is correct; the biggest off-diagonal
  cell tells you exactly which category it gets confused with (e.g. `DINING → GROCERIES`).

### Reading the two reports together

Now that the dataset has failable cases, **expect macro-F1 below 100%**. Compare `report.md`
(thinking ON) against `report-nothinking.md` (OFF):

- **If OFF barely dents macro-F1 but cuts cost + latency** (thoughts tokens → ~0) → disable thinking
  for this classifier; you're paying for reasoning that doesn't change the answer.
- **If OFF tanks macro-F1 on the ambiguous rows** → keep thinking; the reasoning is earning its cost.

Both reports are safe to commit because the dataset is synthetic (no PII).
