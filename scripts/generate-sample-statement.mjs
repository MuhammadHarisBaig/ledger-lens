// Generates samples/sample-statement.pdf — a synthetic statement (NO real personal data)
// that matches the M2 parseStatement format: each transaction line is
//   <date>  <description...>  <amount>
// plus a few noise lines (header, column labels, closing balance) to exercise skippedLines.
//
// Run: node scripts/generate-sample-statement.mjs
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import PDFDocument from "pdfkit";

const LINES = [
  "Statement of Account - ACME BANK (SAMPLE)", // noise: not a transaction
  "Date        Description             Amount", // noise: column header
  "2024-01-05  STARBUCKS COFFEE        -5.50",
  "2024-01-06  ACME PAYROLL            1,250.00",
  "2024-01-07  RENT PAYMENT            (900.00)",
  "2024-01-08  GROCERY MART            -84.20",
  "2024-01-09  INTEREST PAID           0.12",
  "Closing Balance                     260.42", // noise: running balance
];

const outPath = resolve(process.cwd(), "samples", "sample-statement.pdf");
mkdirSync(dirname(outPath), { recursive: true });

const doc = new PDFDocument({ size: "A4", margin: 50 });
const stream = createWriteStream(outPath);
doc.pipe(stream);

// Courier (monospaced) keeps the columns visually aligned; each doc.text() call is its own
// line (pdfkit advances the cursor), which pdf.js then extracts with real line breaks.
doc.font("Courier").fontSize(11);
for (const line of LINES) {
  doc.text(line);
}
doc.end();

stream.on("finish", () => console.log(`Wrote ${outPath}`));
stream.on("error", (e) => {
  console.error(e);
  process.exitCode = 1;
});
