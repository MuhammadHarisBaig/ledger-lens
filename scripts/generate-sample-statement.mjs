// Generates the synthetic sample statements under samples/ (NO real personal data) that match
// the M2 parseStatement format: each transaction line is `<date>  <description...>  <amount>`,
// plus a few noise lines (header, column labels, closing balance) to exercise skippedLines.
//
// Two statements with DIFFERENT contents => different SHA-256 content hashes, so each can be
// uploaded as a distinct statement (the second one is handy for watching a fresh async run
// through the worker without hitting the idempotency short-circuit).
//
// Run: node scripts/generate-sample-statement.mjs
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import PDFDocument from "pdfkit";

const STATEMENTS = [
  {
    file: "sample-statement.pdf",
    lines: [
      "Statement of Account - ACME BANK (SAMPLE)", // noise: not a transaction
      "Date        Description             Amount", // noise: column header
      "2024-01-05  STARBUCKS COFFEE        -5.50",
      "2024-01-06  ACME PAYROLL            1,250.00",
      "2024-01-07  RENT PAYMENT            (900.00)",
      "2024-01-08  GROCERY MART            -84.20",
      "2024-01-09  INTEREST PAID           0.12",
      "Closing Balance                     260.42", // noise: running balance
    ],
  },
  {
    file: "sample-statement-2.pdf",
    lines: [
      "Statement of Account - GLOBEX BANK (SAMPLE)", // noise
      "Date        Description             Amount", // noise: column header
      "2024-02-03  UBER TRIP               -18.75",
      "2024-02-04  SALARY DEPOSIT          3,000.00",
      "2024-02-05  ELECTRIC BILL           (140.30)",
      "2024-02-06  AMAZON ORDER            -59.99",
      "2024-02-10  GYM MEMBERSHIP          -29.00",
      "Closing Balance                     2,751.96", // noise: running balance
    ],
  },
];

function writePdf(file, lines) {
  const outPath = resolve(process.cwd(), "samples", file);
  mkdirSync(dirname(outPath), { recursive: true });
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = createWriteStream(outPath);
  doc.pipe(stream);
  // Courier (monospaced) keeps the columns visually aligned; each doc.text() call is its own
  // line (pdfkit advances the cursor), which pdf.js then extracts with real line breaks.
  doc.font("Courier").fontSize(11);
  for (const line of lines) doc.text(line);
  doc.end();
  return new Promise((res, rej) => {
    stream.on("finish", () => {
      console.log(`Wrote ${outPath}`);
      res();
    });
    stream.on("error", rej);
  });
}

for (const { file, lines } of STATEMENTS) {
  await writePdf(file, lines);
}
