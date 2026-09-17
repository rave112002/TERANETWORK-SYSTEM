/**
 * Reads a password-protected PDF into lines of positioned text.
 *
 * ── Nothing here touches the disk ───────────────────────────────────────────
 *
 * The statement is a personal GCash transaction history (docs/decisions.md D9).
 * The buffer comes from multer's memory storage and the password from the
 * request body; both go out of scope when this returns. Neither is logged, and
 * an error message never repeats the password back.
 *
 * ── Why positions are kept ──────────────────────────────────────────────────
 *
 * A PDF has no table, only text drawn at coordinates. The parser needs the x
 * of each piece to tell the Debit column from the Credit column, and the y to
 * put pieces of one row back together.
 */

/** The file needs a password and none was given. */
export class StatementPasswordRequiredError extends Error {
  constructor() {
    super("This PDF is password-protected. Enter the password to open it.");
    this.name = "StatementPasswordRequiredError";
  }
}

/** A password was given and it was wrong. */
export class StatementPasswordIncorrectError extends Error {
  constructor() {
    super("The password is incorrect.");
    this.name = "StatementPasswordIncorrectError";
  }
}

/** Not a PDF, or a PDF that could not be read. */
export class StatementUnreadableError extends Error {
  constructor() {
    super("This file could not be read as a PDF.");
    this.name = "StatementUnreadableError";
  }
}

// pdf.js's own password exception codes.
const NEED_PASSWORD = 1;
const INCORRECT_PASSWORD = 2;

// Pieces whose baselines are this close (in PDF units) sit on one line.
const LINE_TOLERANCE = 2.5;

let pdfjsPromise;
const loadPdfjs = () => {
  // The legacy build is the one that runs in Node without a DOM.
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjsPromise;
};

/**
 * @typedef {Object} TextPiece
 * @property {string} str
 * @property {number} x   left edge
 * @property {number} width
 *
 * @typedef {Object} TextLine
 * @property {number} page 1-based
 * @property {number} y    distance from the top of the page
 * @property {TextPiece[]} pieces left to right
 */

/**
 * @param {Buffer|Uint8Array} buffer
 * @param {string} [password]
 * @returns {Promise<TextLine[]>} every line of every page, top to bottom.
 */
export const readPdfLines = async (buffer, password = "") => {
  const pdfjs = await loadPdfjs();

  let task;
  let doc;
  try {
    task = pdfjs.getDocument({
      // A copy: pdf.js detaches the array it is given.
      data: new Uint8Array(buffer),
      password,
      // Hardening for untrusted files — no eval'd font programs, no fetching.
      isEvalSupported: false,
      disableFontFace: true,
      useSystemFonts: false,
      stopAtErrors: true,
      verbosity: 0,
    });
    doc = await task.promise;
  } catch (err) {
    await task?.destroy();
    if (err?.name === "PasswordException") {
      if (err.code === INCORRECT_PASSWORD) throw new StatementPasswordIncorrectError();
      if (err.code === NEED_PASSWORD) throw new StatementPasswordRequiredError();
    }
    throw new StatementUnreadableError();
  }

  try {
    const lines = [];
    for (let pageNo = 1; pageNo <= doc.numPages; pageNo++) {
      const page = await doc.getPage(pageNo);
      const { height } = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();

      const pieces = content.items
        .filter((item) => typeof item.str === "string" && item.str.trim() !== "")
        .map((item) => ({
          str: item.str,
          x: item.transform[4],
          // PDF y grows upwards; flip it so lines sort top to bottom.
          y: height - item.transform[5],
          width: item.width,
        }))
        .sort((a, b) => a.y - b.y || a.x - b.x);

      const pageLines = [];
      for (const piece of pieces) {
        const line = pageLines.find((l) => Math.abs(l.y - piece.y) <= LINE_TOLERANCE);
        if (line) line.pieces.push(piece);
        else pageLines.push({ page: pageNo, y: piece.y, pieces: [piece] });
      }
      for (const line of pageLines) {
        line.pieces.sort((a, b) => a.x - b.x);
        line.pieces = line.pieces.map(({ str, x, width }) => ({ str, x, width }));
      }
      lines.push(...pageLines.sort((a, b) => a.y - b.y));
    }
    return lines;
  } finally {
    await task.destroy();
  }
};

export default {
  readPdfLines,
  StatementPasswordRequiredError,
  StatementPasswordIncorrectError,
  StatementUnreadableError,
};
