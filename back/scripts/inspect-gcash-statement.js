/**
 * Shows how the GCash statement reader sees a real transaction-history PDF —
 * WITHOUT printing what is in it.
 *
 *   npm run gcash:inspect -- "C:\path\to\statement.pdf"
 *
 * The password is asked for and not echoed. Every letter in the output becomes
 * `x`/`X` and every digit `9`, so names, numbers, references and amounts never
 * appear, but the layout does: which lines exist, where the columns sit, what
 * the dates look like, and what the parser made of each row. That is what is
 * needed to adjust `server/src/lib/payments/gcash-statement/parser.js` to a
 * format change, and it is safe to paste into a chat or an issue.
 */
import { readFile } from "node:fs/promises";
import readline from "node:readline";

import { parseGcashStatement } from "../server/src/lib/payments/gcash-statement/parser.js";
import { readPdfLines } from "../server/src/lib/payments/gcash-statement/pdfText.js";

const mask = (value) =>
  String(value ?? "")
    .replace(/[A-Z]/g, "X")
    .replace(/[a-z]/g, "x")
    .replace(/\d/g, "9");

const askHidden = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });
    rl._writeToOutput = (s) => {
      if (s.startsWith(question)) process.stdout.write(question);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });

const file = process.argv[2];
if (!file) {
  console.error('Usage: npm run gcash:inspect -- "path\\to\\statement.pdf"');
  process.exit(1);
}

const password = process.env.GCASH_PDF_PASSWORD ?? (await askHidden("PDF password: "));
const lines = await readPdfLines(await readFile(file), password);
const result = parseGcashStatement(lines);

console.log(`\nPages: ${Math.max(0, ...lines.map((l) => l.page))}   Lines: ${lines.length}`);
console.log("\n── Lines (masked) — page · y · [x] text ──");
for (const line of lines) {
  const cells = line.pieces.map((p) => `[${Math.round(p.x)}] ${mask(p.str)}`).join("   ");
  console.log(`p${line.page} y${String(Math.round(line.y)).padStart(4)}  ${cells}`);
}

console.log("\n── What the parser found ──");
console.log(`Column headings found: ${result.headerFound}`);
console.log(`Period: ${mask(result.periodStart)} → ${mask(result.periodEnd)}`);
console.log(`Rows: ${result.transactions.length}`);
console.log(`  in:  ${result.transactions.filter((t) => t.direction === "credit").length}`);
console.log(`  out: ${result.transactions.filter((t) => t.direction === "debit").length}`);
console.log(`  unplaced: ${result.transactions.filter((t) => !t.direction).length}`);
console.log(`Statement total credit found: ${result.totalCredit !== null}`);
for (const t of result.transactions) {
  console.log(
    `  ${mask(t.transactedAt)} | ${String(t.direction).padEnd(6)} | ref ${mask(t.referenceNo).padEnd(16)} | amt ${mask(t.amount)} | ${mask(t.description).slice(0, 50)}`
  );
}
console.log(`Warnings: ${result.warnings.length ? "" : "none"}`);
result.warnings.forEach((w) => console.log(`  - ${mask(w)}`));
