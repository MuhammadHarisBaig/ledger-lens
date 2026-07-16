/**
 * Parse a statement-style amount string into a number.
 *
 * Handles thousands separators ("1,250.00"), plain decimals ("45.99"), and
 * surrounding whitespace ("  10.00 "). Throws on anything that isn't a clean
 * number so bad statement rows fail loudly instead of poisoning downstream sums.
 */
export function parseAmount(input: string): number {
  const cleaned = input.trim().replace(/,/g, "");
  const value = Number(cleaned); // Number() is strict: "45.99abc" -> NaN
  if (cleaned === "" || Number.isNaN(value)) {
    throw new Error(`Invalid amount: "${input}"`);
  }
  return value;
}
