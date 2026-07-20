/**
 * Parse a statement-style amount string into a number.
 *
 * Handles thousands separators ("1,250.00"), plain decimals ("45.99"),
 * surrounding whitespace ("  10.00 "), and sign — both a leading minus
 * ("-1,250.00" -> -1250) and accounting parentheses ("(1,250.00)" -> -1250,
 * money out). Throws on anything that isn't a clean number so bad statement
 * rows fail loudly instead of poisoning downstream sums.
 *
 * Sign lives here (not in the line parser) so ALL amount semantics — separators,
 * decimals, sign, and rejection — sit in one unit-tested place.
 */
export function parseAmount(input: string): number {
  let cleaned = input.trim();

  // Accounting notation: wrapping parentheses mean negative, e.g. "(1,250.00)" -> -1250.
  let negative = false;
  if (cleaned.startsWith("(") && cleaned.endsWith(")")) {
    negative = true;
    cleaned = cleaned.slice(1, -1).trim();
  }

  cleaned = cleaned.replace(/,/g, ""); // a leading "-" is preserved and handled by Number()
  const value = Number(cleaned); // Number() is strict: "45.99abc" -> NaN
  if (cleaned === "" || Number.isNaN(value)) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  return negative ? -value : value;
}
