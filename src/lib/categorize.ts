import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { TransactionCategory } from "@prisma/client";
import { requireEnv } from "@/lib/env";

// Bump when the category taxonomy changes so M5 eval results are tagged and never compared across
// incompatible label spaces.
export const CATEGORY_SCHEMA_VERSION = 1;

export const MODEL = "gemini-2.5-flash";
const CATEGORIES = Object.values(TransactionCategory); // enum values are the source of truth

// Approximate per-1M-token pricing for the model (USD) — for a rough cost estimate only; update
// from current Gemini pricing as needed. This is observability, not billing.
const INPUT_USD_PER_1M = 0.3;
const OUTPUT_USD_PER_1M = 2.5;

export type TxnForCategorize = { date: Date; rawDescription: string; amount: number };

// Controls the model's "thinking" budget: 0 = OFF, -1 = AUTOMATIC, omit = model default.
// Default (omitted) preserves the current behavior — the worker calls with no options.
export type CategorizeOptions = { thinkingBudget?: number };

export type CategorizeMetrics = {
  latencyMs: number;
  promptTokens?: number;
  candidatesTokens?: number;
  thoughtsTokens?: number; // "thinking" tokens — bill at the OUTPUT rate (see estimateCostUsd)
  totalTokens?: number;
  costEstimateUsd?: number;
  schemaVersion: number;
};

// LAZY Gemini client — reads GEMINI_API_KEY at call time (CI-safe; import has no side effects).
function getGeminiClient(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: requireEnv("GEMINI_API_KEY") });
}

function buildPrompt(txns: TxnForCategorize[]): string {
  const lines = txns.map(
    (t, i) => `${i}: ${t.rawDescription} | amount ${t.amount}`,
  );
  return [
    "You categorize bank/credit-card statement transactions.",
    `Assign each transaction EXACTLY ONE category from this fixed set: ${CATEGORIES.join(", ")}.`,
    "A negative amount is money out; a positive amount is money in.",
    'Respond with ONLY a JSON array, one object per transaction: [{"index": <number>, "category": "<CATEGORY>"}].',
    "Use OTHER if unsure. Do not invent categories outside the set.",
    "",
    "Transactions:",
    ...lines,
  ].join("\n");
}

// GOTCHA: "thinking" (thoughts) tokens bill at the OUTPUT rate but are NOT part of
// candidatesTokenCount, so costing output as candidates-only understates the bill (often by >half).
// Callers pass the FULL billable output (candidates + thoughts + tool-use), computed as
// totalTokenCount - promptTokenCount.
function estimateCostUsd(promptTokens?: number, outputTokens?: number): number | undefined {
  if (promptTokens === undefined && outputTokens === undefined) return undefined;
  return ((promptTokens ?? 0) * INPUT_USD_PER_1M + (outputTokens ?? 0) * OUTPUT_USD_PER_1M) / 1_000_000;
}

const llmSchema = z.array(z.object({ index: z.number().int(), category: z.string() }));
const toCategory = (s: string): TransactionCategory =>
  (CATEGORIES as string[]).includes(s) ? (s as TransactionCategory) : "OTHER";

/**
 * Categorize transactions in ONE batched Gemini call (one round-trip for N transactions, not N
 * calls — amortizes prompt/overhead tokens, avoids N× latency and rate-limit exposure).
 *
 * Failure model:
 *  - The CALL throwing (network/timeout/auth/missing key) PROPAGATES — the worker treats it as a
 *    transient failure and retries (the parse isn't lost).
 *  - A RESPONSE that's malformed/partial/hallucinated is never trusted: we Zod-validate and default
 *    any missing/invalid entry to OTHER, so bad model output can NEVER crash the pipeline.
 */
export async function categorizeTransactions(
  txns: TxnForCategorize[],
  options?: CategorizeOptions,
): Promise<{ categories: TransactionCategory[]; metrics: CategorizeMetrics }> {
  const client = getGeminiClient();
  const start = Date.now();
  const res = await client.models.generateContent({
    model: MODEL,
    contents: buildPrompt(txns),
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      // Only set thinkingConfig when a budget is given, so the default call is unchanged.
      ...(options?.thinkingBudget !== undefined
        ? { thinkingConfig: { thinkingBudget: options.thinkingBudget } }
        : {}),
    },
  });
  const latencyMs = Date.now() - start;

  const usage = res.usageMetadata;
  // Billable output = everything the model generated = total - prompt (captures candidates +
  // thoughts + any tool-use). Fall back to candidates+thoughts if total/prompt aren't reported.
  const billableOutputTokens =
    usage?.totalTokenCount !== undefined && usage?.promptTokenCount !== undefined
      ? usage.totalTokenCount - usage.promptTokenCount
      : (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0);
  const metrics: CategorizeMetrics = {
    latencyMs,
    promptTokens: usage?.promptTokenCount,
    candidatesTokens: usage?.candidatesTokenCount,
    thoughtsTokens: usage?.thoughtsTokenCount,
    totalTokens: usage?.totalTokenCount,
    costEstimateUsd: estimateCostUsd(usage?.promptTokenCount, billableOutputTokens),
    schemaVersion: CATEGORY_SCHEMA_VERSION,
  };

  // Default everything to OTHER, then fill in whatever the model returned validly.
  const categories: TransactionCategory[] = Array(txns.length).fill("OTHER");
  try {
    const parsed = llmSchema.safeParse(JSON.parse(res.text ?? ""));
    if (parsed.success) {
      for (const { index, category } of parsed.data) {
        if (index >= 0 && index < txns.length) categories[index] = toCategory(category);
      }
    }
  } catch {
    /* malformed JSON → keep all OTHER (never throw on model output) */
  }

  return { categories, metrics };
}
