import { money, toAmount } from "../../money/money.js";
import { normalizePaymentReference } from "../reference.js";

/**
 * Turns the lines of a GCash transaction-history PDF into transactions.
 *
 * ── Written defensively, on purpose ─────────────────────────────────────────
 *
 * GCash does not publish this layout and can change it. The parser therefore
 * leans on what a transaction row must contain rather than on exact positions:
 *
 *   - a date and time, near the left of the row
 *   - a reference number (a run of digits)
 *   - an amount and a running balance (numbers with two decimals)
 *
 * When the column headings are found (Debit / Credit / Balance), each amount
 * goes to the heading it sits under. When they are not, the running balance
 * decides: money in raises it, money out lowers it.
 *
 * Anything it cannot place is reported in `warnings` instead of being guessed.
 * `scripts/inspect-gcash-statement.js` prints the shape of a real file without
 * its contents, for when this needs adjusting.
 *
 * Pure: no pdf.js, no database. Input is `readPdfLines()` output.
 */

const MONTHS = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

const pad = (n) => String(n).padStart(2, "0");

const TIME = String.raw`(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AaPp][Mm])?`;
const DATE_PATTERNS = [
  // 2026-08-01
  { re: String.raw`(\d{4})-(\d{2})-(\d{2})`, ymd: (m) => [m[1], m[2], m[3]] },
  // 08/01/2026 — month first, as the Philippines writes it
  { re: String.raw`(\d{1,2})/(\d{1,2})/(\d{4})`, ymd: (m) => [m[3], m[1], m[2]] },
  // Aug 1, 2026 / August 01 2026
  {
    re: String.raw`([A-Za-z]{3,9})\.?\s+(\d{1,2}),?\s+(\d{4})`,
    ymd: (m) => [m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], m[2]],
  },
];

// Compiled once from the constant patterns above — no input reaches a RegExp constructor.
/* eslint-disable security/detect-non-literal-regexp */
const LEADING_DATE_TIME = DATE_PATTERNS.map((p) => ({
  ...p,
  regex: new RegExp(String.raw`^\s*${p.re},?\s+${TIME}`),
}));
const ANY_DATE = DATE_PATTERNS.map((p) => ({ ...p, regex: new RegExp(p.re, "g") }));
/* eslint-enable security/detect-non-literal-regexp */

const validYmd = ([y, mo, d]) => {
  const year = Number(y);
  const month = Number(mo);
  const day = Number(d);
  if (!year || !month || !day || month > 12 || day > 31) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
};

/** A date-and-time at the start of `text`, as 'YYYY-MM-DD HH:mm:ss'. */
export const parseLeadingDateTime = (text) => {
  for (const { regex, ymd } of LEADING_DATE_TIME) {
    const m = regex.exec(text);
    if (!m) continue;
    const date = validYmd(ymd(m));
    if (!date) continue;
    // The time groups follow the date's three groups.
    let hour = Number(m[4]);
    const minute = Number(m[5]);
    const second = Number(m[6] || 0);
    const meridiem = m[7]?.toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    if (hour > 23 || minute > 59 || second > 59) continue;
    return { value: `${date} ${pad(hour)}:${pad(minute)}:${pad(second)}`, length: m[0].length };
  }
  return null;
};

/** Every bare date in `text`, as 'YYYY-MM-DD'. */
const findDates = (text) => {
  const found = [];
  for (const { regex, ymd } of ANY_DATE) {
    for (const m of text.matchAll(regex)) {
      const date = validYmd(ymd(m));
      if (date) found.push({ date, index: m.index });
    }
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.date);
};

const AMOUNT = /^[-(]?(?:₱|PHP)?-?[\d,]+\.\d{2}\)?$/i;
const DIGITS = /^\d+$/;
const REFERENCE_LENGTH = { min: 8, max: 20 };
const FOOTER = /ending balance|total debit|total credit|end of (the )?statement|page \d+ of \d+/i;
const STARTING_BALANCE = /(starting|beginning|opening) balance/i;
// A line this far (PDF units) below its row's last line is not part of the row.
const WRAP_GAP = 30;

const parseAmount = (str) => {
  const negative = /^[-(]|\)$/.test(str) || str.includes("-");
  const value = money(str.replace(/[^\d.]/g, ""));
  return toAmount(negative ? value.negated() : value);
};

/** Split a line's pieces into words, estimating each word's centre. */
const tokenize = (line) =>
  line.pieces.flatMap((piece) => {
    const tokens = [];
    const re = /\S+/g;
    const perChar = piece.str.length ? piece.width / piece.str.length : 0;
    for (const m of piece.str.matchAll(re)) {
      const x = piece.x + m.index * perChar;
      const width = m[0].length * perChar;
      tokens.push({ text: m[0], x, center: x + width / 2, end: x + width });
    }
    return tokens;
  });

const lineText = (line) =>
  line.pieces
    .map((p) => p.str)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

/** Column centres from a heading row, or null if this is not one. */
const readHeader = (tokens) => {
  const lower = tokens.map((t) => t.text.toLowerCase().replace(/[^a-z]/g, ""));
  const at = (word) => lower.indexOf(word);
  const debit = at("debit");
  const credit = at("credit");
  if (debit === -1 || credit === -1) return null;

  const reference = at("reference") !== -1 ? at("reference") : at("ref");
  let referenceCenter = null;
  if (reference !== -1) {
    // "Reference No." — centre the phrase, not just the first word.
    const next = tokens[reference + 1];
    const end =
      next && /^(no|number)$/.test(lower[reference + 1]) ? next.end : tokens[reference].end;
    referenceCenter = (tokens[reference].x + end) / 2;
  }
  const balance = at("balance");
  return {
    debit: tokens[debit].center,
    credit: tokens[credit].center,
    balance: balance === -1 ? null : tokens[balance].center,
    reference: referenceCenter,
  };
};

/**
 * Merge all-digit tokens separated by a single space, so "1234 567 890123" is
 * one reference — but not a phone number in the description and the reference
 * in the next column, which are far apart.
 */
const digitGroups = (tokens) => {
  const groups = [];
  let current = null;
  tokens.forEach((token, index) => {
    if (DIGITS.test(token.text)) {
      const charWidth = (token.end - token.x) / token.text.length;
      const closeEnough = current && token.x - current.end <= charWidth * 2.5;
      if (current && current.lastIndex === index - 1 && closeEnough) {
        current.text += token.text;
        current.end = token.end;
        current.indexes.push(index);
        current.lastIndex = index;
      } else {
        current = {
          text: token.text,
          x: token.x,
          end: token.end,
          indexes: [index],
          lastIndex: index,
        };
        groups.push(current);
      }
    } else {
      current = null;
    }
  });
  return groups
    .map((g) => ({ ...g, center: (g.x + g.end) / 2 }))
    .filter((g) => g.text.length >= REFERENCE_LENGTH.min && g.text.length <= REFERENCE_LENGTH.max);
};

const nearest = (center, columns) =>
  Object.entries(columns)
    .filter(([, c]) => c !== null)
    .sort((a, b) => Math.abs(a[1] - center) - Math.abs(b[1] - center))[0]?.[0];

/**
 * One transaction from the tokens of its row, date and time already removed:
 * the date line plus any wrapped description lines, top to bottom.
 */
const readRow = (body, header) => {
  const used = new Set();

  const amounts = [];
  body.forEach((t, i) => {
    if (AMOUNT.test(t.text)) {
      amounts.push({ ...t, index: i, value: parseAmount(t.text) });
      used.add(i);
    }
  });

  const firstAmountX = amounts.length ? Math.min(...amounts.map((a) => a.x)) : Infinity;
  const candidates = digitGroups(body).filter((g) => g.x < firstAmountX);
  let reference = null;
  if (candidates.length) {
    reference =
      header && header.reference !== null
        ? [...candidates].sort(
            (a, b) => Math.abs(a.center - header.reference) - Math.abs(b.center - header.reference)
          )[0]
        : candidates[candidates.length - 1];
    reference.indexes.forEach((i) => used.add(i));
  }

  const description = body
    .filter((t, i) => !used.has(i) && !/^(₱|PHP)$/i.test(t.text))
    .map((t) => t.text)
    .join(" ")
    .slice(0, 255);

  const row = {
    description,
    referenceNo: reference ? normalizePaymentReference(reference.text) : null,
    debit: null,
    credit: null,
    balance: null,
    amounts: amounts.map((a) => a.value),
  };

  if (header) {
    for (const amount of amounts) {
      const column = nearest(amount.center, {
        debit: header.debit,
        credit: header.credit,
        balance: header.balance,
      });
      if (column && row[column] === null) row[column] = money(amount.value).abs().toFixed(2);
    }
  } else if (amounts.length >= 2) {
    // [amount, balance] — which way the money went is settled from the balances later.
    row.balance = amounts[amounts.length - 1].value;
  }
  return row;
};

/**
 * Without headings: the direction is whichever reading makes the running
 * balance add up. Tries the rows in the order printed, then reversed (newest
 * first), and keeps the order that explains more rows.
 */
const directionsFromBalances = (rows, startingBalance) => {
  const attempt = (ordered, opening) => {
    let previous = opening;
    let explained = 0;
    const result = new Map();
    for (const row of ordered) {
      const amount = row.amounts.length >= 2 ? row.amounts[row.amounts.length - 2] : null;
      if (amount !== null && previous !== null && row.balance !== null) {
        const delta = money(row.balance).minus(previous);
        if (delta.equals(money(amount).abs())) {
          result.set(row, "credit");
          explained++;
        } else if (delta.equals(money(amount).abs().negated())) {
          result.set(row, "debit");
          explained++;
        }
      }
      previous = row.balance ?? previous;
    }
    return { result, explained };
  };
  const forward = attempt(rows, startingBalance);
  const backward = attempt([...rows].reverse(), null);
  return (backward.explained > forward.explained ? backward : forward).result;
};

/** A parsed row as a transaction: which way the money went, and how much. */
const toTransaction = (row, byBalance) => {
  let direction = null;
  let amount = null;
  if (row.credit !== null && row.debit === null) {
    direction = "credit";
    amount = row.credit;
  } else if (row.debit !== null && row.credit === null) {
    direction = "debit";
    amount = row.debit;
  } else if (byBalance?.has(row)) {
    direction = byBalance.get(row);
    amount = money(row.amounts[row.amounts.length - 2])
      .abs()
      .toFixed(2);
  }
  return {
    transactedAt: row.transactedAt,
    description: row.description,
    referenceNo: row.referenceNo,
    direction,
    amount,
    balance: row.balance,
  };
};

/** What a person should know before trusting the result. */
const collectWarnings = (transactions, totalCredit) => {
  const warnings = [];
  const unplaced = transactions.filter((t) => !t.direction).length;
  if (unplaced)
    warnings.push(`${unplaced} row(s): could not tell whether money came in or went out.`);
  const noReference = transactions.filter((t) => t.direction === "credit" && !t.referenceNo).length;
  if (noReference) warnings.push(`${noReference} incoming row(s) have no reference number.`);

  if (totalCredit !== null) {
    const sum = transactions
      .filter((t) => t.direction === "credit")
      .reduce((acc, t) => acc.plus(t.amount), money(0));
    if (!sum.equals(money(totalCredit))) {
      warnings.push(
        `Incoming amounts add up to ${sum.toFixed(2)}, but the statement's total credit is ${totalCredit}. Some rows may have been missed.`
      );
    }
  }
  return warnings;
};

/**
 * Give each wrapped description line to the NEAREST row on its page, not the
 * row above it. GCash centres a row's cells vertically, so a two-line
 * description starts slightly above its own date and time and ends slightly
 * below (seen on a real statement, 2026-09-17).
 */
const attachWrappedLines = (rows, loose) => {
  for (const part of loose) {
    let best = null;
    for (const row of rows) {
      if (row.page !== part.page) continue;
      const distance = Math.abs(row.y - part.y);
      // Strictly closer wins; on a tie the earlier row keeps it.
      if (distance <= WRAP_GAP && (!best || distance < best.distance)) best = { row, distance };
    }
    best?.row.parts.push(part);
  }
};

/**
 * @param {import('./pdfText.js').TextLine[]} lines
 * @returns {{
 *   transactions: Array<{ transactedAt: string, description: string, referenceNo: string|null,
 *     direction: 'credit'|'debit'|null, amount: string|null, balance: string|null }>,
 *   periodStart: string|null, periodEnd: string|null,
 *   headerFound: boolean, totalCredit: string|null, warnings: string[] }}
 */
export const parseGcashStatement = (lines) => {
  let header = null;
  let headerFound = false;
  let period = null;
  let startingBalance = null;
  let totalCredit = null;
  const rows = [];
  // Lines inside the table that are not a row of their own: wrapped descriptions.
  const loose = [];
  let inTable = false;

  for (const line of lines) {
    const text = lineText(line);
    const tokens = tokenize(line);

    const heading = readHeader(tokens);
    if (heading) {
      header = heading;
      headerFound = true;
      inTable = true;
      continue;
    }

    if (FOOTER.test(text)) {
      inTable = false;
      if (/total credit/i.test(text)) {
        const amount = tokens.map((t) => t.text).find((t) => AMOUNT.test(t));
        if (amount) totalCredit = money(parseAmount(amount)).abs().toFixed(2);
      }
      continue;
    }

    if (STARTING_BALANCE.test(text)) {
      const amount = tokens.map((t) => t.text).find((t) => AMOUNT.test(t));
      if (amount) startingBalance = parseAmount(amount);
      continue;
    }

    const dateTime = parseLeadingDateTime(text);
    if (dateTime) {
      // How many tokens the date and time used, so they stay out of the description.
      let consumed = 0;
      let length = 0;
      while (consumed < tokens.length && length < dateTime.length - 1) {
        length += tokens[consumed].text.length + 1;
        consumed++;
      }
      rows.push({
        transactedAt: dateTime.value,
        page: line.page,
        y: line.y,
        parts: [{ y: line.y, tokens: tokens.slice(consumed) }],
      });
      inTable = true;
      continue;
    }

    const dates = findDates(text);
    if (dates.length >= 2 && !tokens.some((t) => AMOUNT.test(t.text))) {
      if (!period) {
        const [start, end] = [dates[0], dates[1]].sort();
        period = { start, end };
      }
      continue;
    }

    if (inTable) loose.push({ page: line.page, y: line.y, tokens });
  }

  attachWrappedLines(rows, loose);

  const parsed = rows.map((r) => ({
    transactedAt: r.transactedAt,
    ...readRow(
      [...r.parts].sort((a, b) => a.y - b.y).flatMap((p) => p.tokens),
      header
    ),
  }));

  const byBalance = headerFound ? null : directionsFromBalances(parsed, startingBalance);
  const transactions = parsed.map((row) => toTransaction(row, byBalance));
  const warnings = collectWarnings(transactions, totalCredit);

  const dates = transactions.map((t) => t.transactedAt.slice(0, 10)).sort();
  return {
    transactions,
    periodStart: period?.start ?? dates[0] ?? null,
    periodEnd: period?.end ?? dates[dates.length - 1] ?? null,
    headerFound,
    totalCredit,
    warnings,
  };
};

export default { parseGcashStatement, parseLeadingDateTime };
