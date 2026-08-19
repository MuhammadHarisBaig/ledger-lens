# Evaluating the transaction categorizer

LedgerLens categorizes each parsed statement transaction into a fixed taxonomy (`GROCERIES`,
`DINING`, `INCOME`, …) with a single batched Gemini call. This note records how that categorizer was
evaluated and the two decisions the evaluation drove. The harness lives in [`eval/`](../eval); the
raw results are [`eval/report.md`](../eval/report.md) (thinking ON) and
[`eval/report-nothinking.md`](../eval/report-nothinking.md) (thinking OFF).

## What the harness measures, and why

The categorizer is scored against a hand-labeled **synthetic** dataset ([`eval/dataset.ts`](../eval/dataset.ts))
using three views: overall **accuracy**, per-category **precision/recall/F1**, and a **confusion
matrix**. The headline number is **macro-F1** — the unweighted mean of per-category F1 — rather than
accuracy alone, because macro-F1 weights every category equally and so surfaces a class the model
systematically gets wrong even when it's rare. Accuracy can stay high while a small category is
never once labeled correctly; macro-F1 will not. The metric math is pure and unit-tested in CI; the
real LLM call runs offline, because it costs money and isn't deterministic — the wrong shape for a
CI gate.

## The 100% → hardened → ~96% story

The first dataset scored **100% accuracy / 100% macro-F1**. That was a red flag, not a triumph: a
perfect score meant every example was unambiguous, so the metric couldn't distinguish a good model
from a bad one, couldn't catch a regression, and couldn't justify any tuning decision. A metric only
measures what its inputs can actually separate.

So I hardened the set with ~20 adversarial-but-realistic cases — the kind a real statement contains
and a model can plausibly miss:

- payment-aggregator strings that hide the merchant (`SQ *BLUE BOTTLE`, `PAYPAL *STEAMGAMES`, `SP *…`),
- big-box stores that could be `GROCERIES` or `OTHER` (COSTCO, TARGET, Walmart, Amazon),
- gas-station convenience buys (`SHELL … SNACKS`, `CIRCLE K`) — fuel stop vs snacks,
- cryptic bank/POS codes with almost no signal (`POS DEBIT 7788 234109`),
- refunds (money *in*, but category still follows the merchant, not the sign),
- a fee dressed up as a purchase (`ANNUAL MEMBERSHIP FEE`),
- and the `UBER` vs `UBER EATS` trap (transport vs dining).

On the 60-example hardened set the score settled at **95.0% accuracy / ~96% macro-F1**. That lower
number is the *trustworthy* one — it comes from cases that can genuinely fail. The residual
confusions are the believable ones: two `TRANSPORT` rows (the gas-station-convenience buys) were
read as `GROCERIES`, and `GROCERIES` precision sat at ~80% because those bled into it. Exactly the
boundary you'd expect a merchant-string classifier to struggle with.

## Thinking on/off: a measured decision

`gemini-2.5-flash` "thinks" by default, spending extra thinking tokens that bill at the output rate.
I ran the **same** hardened dataset with thinking ON and with thinking disabled (`thinkingBudget: 0`)
to see whether that reasoning was earning its cost.

| | Thinking ON | Thinking OFF | Δ |
|---|---|---|---|
| Accuracy | 95.0% | 95.0% | 0 |
| Macro-F1 | 96.3% | 96.4% | +0.1 pp (noise) |
| Latency | 14,126 ms | 6,710 ms | **−52.5%** (~2.1× faster) |
| Thinking tokens | 1,933 | 0 | −1,933 |
| Total tokens | 4,536 | 2,607 | −42.5% |
| Est. cost | $0.008753 | $0.003930 | **−55.1%** |

Thinking bought **no** categorization quality on this task — macro-F1 was identical within noise —
while costing roughly double the latency and cost. So the worker now categorizes with
`thinkingBudget: 0` ([`src/app/api/worker/process/route.ts`](../src/app/api/worker/process/route.ts)).
The flag stays a call-site parameter, so the choice is overridable rather than baked in. This is the
point of the harness: a cost/quality question answered with a number, not a hunch.

(Fixing the cost accounting was part of this — thinking tokens bill as output but weren't counted in
the original estimate, which understated cost by more than half. The table above uses the corrected
figure: billable output = total − prompt tokens.)

## Honest limitation

Sixty synthetic, self-authored examples is a small set that I wrote to be plausible. It validates
the *pipeline* and the *metric*, and it's enough to make a defensible thinking on/off call — but it
is not a substitute for real-world data, whose distribution and messiness I can only approximate.
For production I'd expand the set substantially and add **human-labeled** samples drawn from real
(consented, anonymized) statements, then track macro-F1 over time to catch drift as the model and
the merchant landscape change. The numbers here are also a single temperature-0 run per mode, not an
averaged trial.
