import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import { CircleCheck, Download, FileText, TriangleAlert } from "lucide-react";
import dayjs from "dayjs";

import { Button } from "@/components/ui/button";

import Spinner from "../../components/Spinner";
import { formatPeso } from "../../utils/currency";

/**
 * The customer-facing page behind every emailed link and printed QR.
 *
 * ── Written for a phone, at night, by somebody who is annoyed ───────────────
 *
 * The person opening this has just been told they owe money, or that their
 * internet is off. Everything above the fold answers their three questions:
 * how much, by when, and what happens if they do nothing. Line items and
 * period dates come after that.
 *
 * ── No login, no app shell ──────────────────────────────────────────────────
 *
 * The link is the credential — see back/…/controllers/v1/public/pay.controller.js
 * for what that costs and how it is bounded. This page therefore renders
 * outside the admin layout, uses no auth store, and shows nothing about the
 * customer beyond their own name.
 */

/**
 * Plain fetch, not the shared axios instance: that one attaches admin auth
 * headers and a CSRF token this page has no business carrying.
 *
 * The URL is relative, like every other call in the app — Vite proxies
 * /api/v1 in development and the API is served from the same origin in
 * production.
 */
const fetchPublicInvoice = async (token) => {
  const res = await fetch(`/api/v1/public/invoices/${token}`, {
    headers: { Accept: "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.message || "This payment link is not valid");
  return body?.data?.invoice;
};

const STATUS_COPY = {
  paid: {
    tone: "var(--color-success)",
    title: "This invoice is paid",
    body: "Thank you — there is nothing left to settle.",
  },
  void: {
    tone: "var(--color-text-muted)",
    title: "This invoice has been cancelled",
    body: "You do not need to pay it. If you were expecting a bill, please contact us.",
  },
  overdue: {
    tone: "var(--color-error)",
    title: "This invoice is past due",
    body: "Please settle it to avoid an interruption to your service.",
  },
};

const PayInvoice = () => {
  const { token } = useParams();

  const {
    data: invoice,
    error,
    isLoading: loading,
  } = useQuery({
    queryKey: ["public-invoice", token],
    queryFn: () => fetchPublicInvoice(token),
    // A bad link stays bad. Retrying it four times just makes the "not valid"
    // message take five seconds to appear.
    retry: false,
    staleTime: 30 * 1000,
  });

  const pdfUrl = `/api/v1/public/invoices/${token}/pdf`;

  if (loading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{ background: "var(--color-surface-sunken)" }}
      >
        <Spinner size="large" />
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div
        className="flex min-h-screen items-center justify-center px-6"
        style={{ background: "var(--color-surface-sunken)" }}
      >
        <div
          className="w-full max-w-md px-7 py-9 text-center"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <TriangleAlert
            className="mx-auto mb-4 h-9 w-9"
            style={{ color: "var(--color-text-muted)" }}
          />
          <h1
            className="m-0 mb-2 font-semibold"
            style={{ fontSize: 18, color: "var(--color-text-dark)" }}
          >
            This link is not valid
          </h1>
          <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            It may have been mistyped or copied incompletely. Please open the link from your
            invoice email again, or contact your provider.
          </p>
        </div>
      </div>
    );
  }

  const status = STATUS_COPY[invoice.status];
  const isPayable = invoice.status === "issued" || invoice.status === "overdue";

  return (
    <div className="min-h-screen px-4 py-10" style={{ background: "var(--color-surface-sunken)" }}>
      <div className="mx-auto w-full max-w-lg">
        <div className="mb-6 text-center">
          <p
            className="m-0 font-semibold"
            style={{ fontSize: 17, color: "var(--color-text-dark)" }}
          >
            {invoice.companyName}
          </p>
          <p className="m-0 mt-0.5" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Invoice {invoice.invoiceNo}
          </p>
        </div>

        <div
          className="overflow-hidden"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          {/* The amount, first and largest. */}
          <div className="px-7 pt-8 pb-7 text-center">
            <p
              className="m-0 uppercase"
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "var(--color-text-muted)",
              }}
            >
              {isPayable ? "Amount due" : "Invoice total"}
            </p>
            <p
              className="m-0 mt-2 font-semibold"
              style={{
                fontSize: 38,
                lineHeight: 1.1,
                color: "var(--color-text-dark)",
                textDecoration: invoice.status === "void" ? "line-through" : "none",
              }}
            >
              {formatPeso(invoice.total)}
            </p>
            {isPayable && (
              <p
                className="m-0 mt-2"
                style={{
                  fontSize: 13.5,
                  color:
                    invoice.status === "overdue"
                      ? "var(--color-error)"
                      : "var(--color-text-secondary)",
                }}
              >
                Due {dayjs(invoice.dueDate).format("MMMM D, YYYY")}
              </p>
            )}
          </div>

          {status && (
            <div
              className="px-7 py-4 text-center"
              style={{
                borderTop: "1px solid var(--color-line)",
                borderBottom: "1px solid var(--color-line)",
                background: "var(--color-surface-sunken)",
              }}
            >
              <p
                className="m-0 inline-flex items-center gap-2 font-semibold"
                style={{ fontSize: 14, color: status.tone }}
              >
                {invoice.status === "paid" && <CircleCheck className="h-4 w-4" />}
                {status.title}
              </p>
              <p
                className="m-0 mt-1"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                {status.body}
              </p>
            </div>
          )}

          {isPayable && (
            <div className="px-7 py-6" style={{ borderTop: status ? "none" : "1px solid var(--color-line)" }}>
              {/* Online payment arrives with the gateway integration. Until
                  then this says what to do instead — a dead "Pay now" button
                  would be worse than none. */}
              <div
                className="px-4 py-4 text-center"
                style={{
                  borderRadius: 10,
                  border: "1px dashed var(--color-line)",
                }}
              >
                <p
                  className="m-0"
                  style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
                >
                  Online payment is not enabled yet.
                </p>
                <p
                  className="m-0 mt-1.5"
                  style={{ fontSize: 13, color: "var(--color-text-muted)" }}
                >
                  Please settle this at the office, or contact{" "}
                  {invoice.companyEmail ? (
                    <a
                      href={`mailto:${invoice.companyEmail}`}
                      style={{ color: "var(--color-link)" }}
                    >
                      {invoice.companyEmail}
                    </a>
                  ) : (
                    "your provider"
                  )}
                  {invoice.companyPhone ? ` or ${invoice.companyPhone}` : ""}.
                </p>
              </div>
            </div>
          )}

          <div className="px-7 pb-7" style={{ paddingTop: isPayable ? 0 : 24 }}>
            <p
              className="m-0 mb-2 uppercase"
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.08em",
                color: "var(--color-text-muted)",
              }}
            >
              For {dayjs(invoice.billingPeriodStart).format("MMMM YYYY")}
            </p>

            <div style={{ borderTop: "1px solid var(--color-line)" }}>
              {(invoice.lines || []).map((line, i) => (
                <div
                  key={`${line.description}-${i}`}
                  className="flex items-baseline justify-between gap-4 py-2.5"
                  style={{ borderBottom: "1px solid var(--color-line-soft)" }}
                >
                  <span
                    className="min-w-0"
                    style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                  >
                    {line.description}
                  </span>
                  <span
                    className="shrink-0 font-mono"
                    style={{
                      fontSize: 13,
                      color:
                        Number(line.amount) < 0
                          ? "var(--color-success)"
                          : "var(--color-text-dark)",
                    }}
                  >
                    {formatPeso(line.amount)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-baseline justify-between gap-4 pt-3">
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-dark)" }}>
                Total
              </span>
              <span
                className="font-mono"
                style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-dark)" }}
              >
                {formatPeso(invoice.total)}
              </span>
            </div>

            <Button asChild variant="outline" size="lg" className="mt-6 w-full">
              {/* A plain link, not a scripted download: this page has no auth
                  and the endpoint streams the PDF directly. */}
              <a href={pdfUrl} target="_blank" rel="noreferrer">
                <Download />
                Download this invoice
              </a>
            </Button>
          </div>
        </div>

        <p
          className="m-0 mt-6 text-center inline-flex w-full items-center justify-center gap-1.5"
          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
        >
          <FileText className="h-3.5 w-3.5" />
          Billed to {invoice.customerName}
        </p>
      </div>
    </div>
  );
};

export default PayInvoice;
