import { useEffect, useMemo } from "react";
import { CircleAlert, Download, ExternalLink, FileText, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import Spinner from "../../../../../components/Spinner";
import {
  downloadInvoicePdf,
  useGetInvoicePdf,
} from "../../../../../services/requests/admin/billing";
import { decodeHTML } from "../../../../../utils/decode-html";

/**
 * The invoice PDF, shown in place: exactly the document the customer receives.
 *
 * ── Why the backend's PDF and not @react-pdf's <PDFViewer> ──────────────────
 *
 * The layout lives in one place, back/server/src/lib/pdf/invoicePdf.js, and it
 * reads Settings (GCash number, terms) as it renders. Drawing it again in the
 * browser would mean two copies of the invoice that could quietly disagree.
 * So this fetches the rendered file and hands it to the browser's own viewer.
 *
 * The file arrives as a Blob because the API needs the Bearer token, and is
 * shown through an object URL that is revoked when the drawer closes.
 */
const InvoicePdfDrawer = ({ open, invoice, onClose }) => {
  const invoiceId = open ? invoice?.invoiceId : null;
  const { data: blob, isLoading, error, refetch } = useGetInvoicePdf(invoiceId);
  // One object URL per fetched file, released when the file changes or the
  // drawer unmounts — otherwise every preview leaks a copy of the PDF.
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => url && URL.revokeObjectURL(url), [url]);

  const iconButton = {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "1px solid var(--color-line)",
    color: "var(--color-text-secondary)",
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-3xl"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Invoice {invoice?.invoiceNo} PDF</SheetTitle>

        <div className="flex h-full flex-col">
          <div
            className="flex items-center justify-between gap-3 px-6 py-4"
            style={{ borderBottom: "1px solid var(--color-line)" }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                <FileText className="w-5 h-5 text-white" />
              </span>
              <div className="min-w-0">
                <h2
                  className="m-0 font-semibold leading-tight truncate"
                  style={{ fontSize: 17, color: "var(--color-text-dark)" }}
                >
                  {invoice?.invoiceNo}
                </h2>
                <p
                  className="m-0 mt-0.5 truncate"
                  style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                >
                  {decodeHTML(invoice?.customerName) || "—"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!url}
                onClick={() => window.open(url, "_blank", "noopener")}
              >
                <ExternalLink />
                <span className="hidden sm:inline">Open in new tab</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => downloadInvoicePdf(invoice.invoiceId, invoice.invoiceNo)}
              >
                <Download />
                <span className="hidden sm:inline">Download</span>
              </Button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="inline-flex items-center justify-center transition-colors hover:bg-(--color-surface-sunken)"
                style={iconButton}
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          <div className="relative flex-1" style={{ background: "var(--color-surface-sunken)" }}>
            {error ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
                <CircleAlert className="w-7 h-7" style={{ color: "var(--color-error)" }} />
                <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
                  The invoice could not be loaded.
                </p>
                <Button type="button" variant="outline" size="sm" onClick={() => refetch()}>
                  Try again
                </Button>
              </div>
            ) : isLoading || !url ? (
              <div className="flex h-full items-center justify-center">
                <Spinner size="large" />
              </div>
            ) : (
              // Asks Chrome's and Edge's viewer to fit the page width and skip the
              // thumbnail sidebar, which takes half the drawer for a one-page bill.
              <iframe
                title={`Invoice ${invoice?.invoiceNo}`}
                src={`${url}#view=FitH&navpanes=0`}
                className="absolute inset-0 h-full w-full border-0"
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default InvoicePdfDrawer;
