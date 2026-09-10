/**
 * CSV export. Dependency-free, RFC-4180-shaped.
 *
 * Every field is quoted and embedded quotes are doubled, so a customer called
 * "Dela Cruz, Jr." or an address with a comma cannot shift the columns of a
 * report an accountant is reconciling against a bank statement.
 *
 * Rows are CRLF-terminated because that is what RFC 4180 says and what Excel
 * on Windows expects — which is where these files are going.
 */

/**
 * Quote one cell.
 *
 * `null` and `undefined` become an empty quoted field rather than the strings
 * "null" or "undefined", which is what a spreadsheet reader expects for a
 * missing value.
 *
 * @param {unknown} value
 * @returns {string}
 */
const escapeCell = (value) => {
  if (value === null || value === undefined) return '""';

  const text = value instanceof Date ? value.toISOString() : String(value);

  // A leading =, +, - or @ makes Excel treat the cell as a formula, and
  // "=cmd|…" in a field is a known spreadsheet injection. Prefixing a tab keeps
  // such text intact and inert.
  //
  // A plain number is exempt, and that exemption is not optional: without it
  // every negative figure in a report — a credit, a days-past-due of -23 —
  // arrives tab-prefixed, Excel reads the column as TEXT, and the accountant's
  // SUM() over it silently returns zero.
  //
  // Two flat patterns rather than one with an optional decimal group: nesting a
  // `+` inside a `?` group is the shape static analysis calls a catastrophic
  // backtracking risk, and arguing with the linter about whether this instance
  // is exploitable is more expensive than not writing it that way.
  const isPlainNumber = /^-?\d+$/.test(text) || /^-?\d+\.\d+$/.test(text);
  const guarded = !isPlainNumber && /^[=+\-@\t\r]/.test(text) ? `\t${text}` : text;

  return `"${guarded.replace(/"/g, '""')}"`;
};

/**
 * Build CSV text from rows and an explicit column list.
 *
 * The columns are given rather than inferred from the first row, so a report's
 * shape is stable even when a row is missing a key, and so the header order is
 * something a person chose.
 *
 * @param {Array<Object>} rows
 * @param {Array<{key: string, header: string}>} columns
 * @returns {string}
 *
 * @example
 *   toCsv(payments, [
 *     { key: "paidAt", header: "Date" },
 *     { key: "invoiceNo", header: "Invoice" },
 *     { key: "amount", header: "Amount" },
 *   ]);
 */
export const toCsv = (rows, columns) => {
  const lines = [columns.map((c) => escapeCell(c.header)).join(",")];

  for (const row of rows) {
    lines.push(columns.map((c) => escapeCell(row[c.key])).join(","));
  }

  return lines.join("\r\n");
};

/**
 * Send CSV as a download.
 *
 * A UTF-8 BOM is prepended because Excel otherwise reads the file as the local
 * ANSI codepage, and every peso sign and ñ in a Philippine customer list comes
 * out as mojibake. Other readers ignore the BOM.
 *
 * @param {Object} res Express response.
 * @param {string} filename
 * @param {string} csv
 */
export const sendCsv = (res, filename, csv) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(`﻿${csv}`);
};

export default { toCsv, sendCsv };
