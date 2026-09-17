import { createElement as e } from "react";
import { Document, Page, renderToBuffer, Text, View } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";

import { parseGcashStatement } from "./parser.js";
import { readPdfLines, StatementUnreadableError } from "./pdfText.js";

/**
 * Through real pdf.js, on a PDF drawn like a statement. The parser tests cover
 * the layout rules; this proves the text actually comes out of a PDF in a shape
 * they apply to.
 */

const widths = [110, 170, 90, 50, 50, 60];
const cells = (values, bold = false) =>
  e(
    View,
    { style: { flexDirection: "row" } },
    values.map((value, i) =>
      e(
        Text,
        {
          key: i,
          style: {
            width: widths[i],
            fontSize: 8,
            fontFamily: bold ? "Helvetica-Bold" : "Helvetica",
          },
        },
        value
      )
    )
  );

const statementPdf = () =>
  renderToBuffer(
    e(
      Document,
      null,
      e(Page, { size: "A4", style: { padding: 24 } }, [
        e(Text, { key: "t" }, "GCash Transaction History"),
        e(Text, { key: "p", style: { fontSize: 8 } }, "2026-08-01 to 2026-08-31"),
        e(
          View,
          { key: "h" },
          cells(
            ["Date and Time", "Description", "Reference No.", "Debit", "Credit", "Balance"],
            true
          )
        ),
        e(
          View,
          { key: "r1" },
          cells([
            "2026-08-02 09:15 AM",
            "Received GCash from 09171234567",
            "5012345678901",
            "",
            "1,399.00",
            "1,499.00",
          ])
        ),
        e(
          View,
          { key: "r2" },
          cells([
            "2026-08-02 11:00 AM",
            "Payment to MERALCO",
            "5012345678902",
            "500.00",
            "",
            "999.00",
          ])
        ),
      ])
    )
  );

describe("readPdfLines", () => {
  it("reads a statement-shaped PDF that the parser understands", async () => {
    const lines = await readPdfLines(await statementPdf());
    const result = parseGcashStatement(lines);

    expect(result.headerFound).toBe(true);
    expect(result.transactions).toMatchObject([
      {
        referenceNo: "5012345678901",
        direction: "credit",
        amount: "1399.00",
        transactedAt: "2026-08-02 09:15:00",
      },
      { referenceNo: "5012345678902", direction: "debit", amount: "500.00" },
    ]);
    expect(result.periodStart).toBe("2026-08-01");
  });

  it("refuses a file that is not a PDF", async () => {
    await expect(readPdfLines(Buffer.from("not a pdf at all"))).rejects.toBeInstanceOf(
      StatementUnreadableError
    );
  });
});
