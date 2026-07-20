import { Prisma } from "@prisma/client";

/**
 * Format a money value as a fixed 2-decimal string with thousands separators
 * (e.g. "1,250.00", "-1,250.00").
 *
 * Decimal gotcha: Prisma returns `@db.Decimal` columns as `Prisma.Decimal` objects
 * (decimal.js), NOT JS numbers. Never render one directly and never sum them with JS `+`
 * (that reintroduces float error). We format straight from the exact fixed-point string,
 * so no float ever touches the value.
 */
export function formatMoney(value: Prisma.Decimal | number | string): string {
  const fixed = new Prisma.Decimal(value).toFixed(2); // exact, e.g. "-1250.00"
  const negative = fixed.startsWith("-");
  const [intPart, decPart] = fixed.replace("-", "").split(".");
  const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${withSep}.${decPart}`;
}
