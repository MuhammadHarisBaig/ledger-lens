import { parseAmount } from "./parseAmount";

/**
 * M2 statement parser — ONE supported format (deliberately narrow; robust multi-bank
 * parsing is M4's LLM-assisted job, not a regex zoo we'd throw away).
 *
 * ASSUMED FORMAT: one transaction per line, whitespace-separated, as
 *     <date>  <description...>  <amount>
 *   - date        = first token, ISO `YYYY-MM-DD` or `DD/MM/YYYY`
 *   - amount      = last token, a signed number: `-1,250.00` or `(1,250.00)` = money out
 *   - description = everything between (may contain spaces)
 * Lines that don't match (headers, running balances, blanks) are skipped and counted.
 * Never throws — bad lines are collected as skippedLines, not errors.
 */
export type ParsedTxn = { date: Date; rawDescription: string; amount: number };

function toUtcDate(y: number, m: number, d: number): Date | null {
  const date = new Date(Date.UTC(y, m - 1, d));
  // Reject overflow (e.g. 2024-02-31, which JS would silently roll over to March).
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    return null;
  }
  return date;
}

function parseDate(token: string): Date | null {
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(token);
  if (m) return toUtcDate(Number(m[1]), Number(m[2]), Number(m[3]));
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(token);
  if (m) return toUtcDate(Number(m[3]), Number(m[2]), Number(m[1])); // DD/MM/YYYY
  return null;
}

export function parseStatement(text: string): { transactions: ParsedTxn[]; skippedLines: number } {
  const transactions: ParsedTxn[] = [];
  let skippedLines = 0;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") {
      skippedLines++;
      continue;
    }

    const tokens = line.split(/\s+/);
    if (tokens.length < 3) {
      skippedLines++; // need date + at least one description token + amount
      continue;
    }

    const date = parseDate(tokens[0]);
    if (!date) {
      skippedLines++;
      continue;
    }

    let amount: number;
    try {
      amount = parseAmount(tokens[tokens.length - 1]);
    } catch {
      skippedLines++; // NEVER throw on a bad line — count it and move on
      continue;
    }

    transactions.push({ date, rawDescription: tokens.slice(1, -1).join(" "), amount });
  }

  return { transactions, skippedLines };
}
