import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);
const apiMultipart = createAxiosInstanceWithInterceptor("multipart", userTypeAuth.admin);

/**
 * Billing — invoices, payments, adjustments and the cycle runs.
 *
 * Three route groups on the backend, one file here because they are one screen
 * to the person using them: a bill, the money against it, and the corrections
 * that ride onto the next one.
 *
 * There is no update-invoice call and there never should be. An issued invoice
 * is a document the customer has; it is paid, voided, or left alone.
 */

/* ── Invoices ───────────────────────────────────────────────────────────── */

export const getInvoicesApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/invoices", { params: filters });
  return response.data;
};

export const getInvoiceByIdApi = async (invoiceId) => {
  const response = await api.get(`/api/v1/admin/invoices/${invoiceId}`);
  return response.data;
};

/**
 * The rendered PDF, as a Blob.
 *
 * `responseType: "blob"` on this call only — the shared instance unwraps JSON,
 * and letting it parse a PDF produces a corrupt string that fails silently at
 * download time rather than loudly here.
 */
export const getInvoicePdfApi = async (invoiceId) => {
  const response = await api.get(`/api/v1/admin/invoices/${invoiceId}/pdf`, {
    responseType: "blob",
  });
  return response.data;
};

/** @param {{reason: string}} body */
export const voidInvoiceApi = async (invoiceId, body) => {
  const response = await api.post(`/api/v1/admin/invoices/${invoiceId}/void`, body);
  return response.data;
};

export const resendInvoiceApi = async (invoiceId) => {
  const response = await api.post(`/api/v1/admin/invoices/${invoiceId}/resend`);
  return response.data;
};

/** @param {{subscriptionId: string, runDate?: string}} body */
export const generateInvoiceApi = async (body) => {
  const response = await api.post("/api/v1/admin/invoices/generate", body);
  return response.data;
};

/** @param {{runDate?: string, branchId?: string}} body */
export const runBillingCycleApi = async (body = {}) => {
  const response = await api.post("/api/v1/admin/invoices/cycle/run", body);
  return response.data;
};

/** @param {{runDate?: string}} body */
export const runDailyBillingApi = async (body = {}) => {
  const response = await api.post("/api/v1/admin/invoices/daily/run", body);
  return response.data;
};

/* ── Payments ───────────────────────────────────────────────────────────── */

export const getPaymentsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/payments", { params: filters });
  return response.data;
};

/**
 * @param {{invoiceId: string, amount: number, channel: string, paidAt?: string,
 *   notes?: string}} data
 */
export const recordPaymentApi = async (data) => {
  const response = await api.post("/api/v1/admin/payments", data);
  return response.data;
};

/* ── GCash Check (statement reconciliation) ─────────────────────────────── */

export const getPaymentStatementsApi = async () => {
  const response = await api.get("/api/v1/admin/payment-statements");
  return response.data;
};

/**
 * @param {FormData} formData `file` (the PDF) and `password`. The password is
 *   used once by the server to open the file and is never stored.
 */
export const uploadPaymentStatementApi = async (formData) => {
  const response = await apiMultipart.post("/api/v1/admin/payment-statements", formData);
  return response.data;
};

export const getStatementReconciliationApi = async (statementId) => {
  const response = await api.get(
    `/api/v1/admin/payment-statements/${statementId}/reconciliation`
  );
  return response.data;
};

export const deletePaymentStatementApi = async (statementId) => {
  const response = await api.delete(`/api/v1/admin/payment-statements/${statementId}`);
  return response.data;
};

/** @param {{transactionId: string, reviewStatus: 'open'|'not_customer'}} args */
export const reviewStatementTransactionApi = async ({ transactionId, reviewStatus }) => {
  const response = await api.post(
    `/api/v1/admin/payment-statements/transactions/${transactionId}/review`,
    { reviewStatus }
  );
  return response.data;
};

/** @param {{paymentId: string, transactionId: string}} data */
export const fixPaymentReferenceApi = async (data) => {
  const response = await api.post("/api/v1/admin/payment-statements/fix-reference", data);
  return response.data;
};

/* ── Adjustments ────────────────────────────────────────────────────────── */

export const getAdjustmentsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/adjustments", { params: filters });
  return response.data;
};

/**
 * The amount is always positive; the backend applies the sign from `kind`.
 *
 * @param {{subscriptionId: string, kind: string, description: string, amount: number}} data
 */
export const createAdjustmentApi = async (data) => {
  const response = await api.post("/api/v1/admin/adjustments", data);
  return response.data;
};

export const deleteAdjustmentApi = async (pendingChargeId) => {
  const response = await api.delete(`/api/v1/admin/adjustments/${pendingChargeId}`);
  return response.data;
};

/* ── Dunning ────────────────────────────────────────────────────────────── */

export const getAtRiskApi = async () => {
  const response = await api.get("/api/v1/admin/dunning/at-risk");
  return response.data;
};

/** @param {{runDate?: string}} body */
export const runDunningSweepApi = async (body = {}) => {
  const response = await api.post("/api/v1/admin/dunning/sweep", body);
  return response.data;
};

export const getExemptionsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/dunning/exemptions", { params: filters });
  return response.data;
};

/** @param {{subscriptionId: string, reason: string, expiresAt: string}} data */
export const createExemptionApi = async (data) => {
  const response = await api.post("/api/v1/admin/dunning/exemptions", data);
  return response.data;
};

export const revokeExemptionApi = async (exemptionId, reason) => {
  const response = await api.post(`/api/v1/admin/dunning/exemptions/${exemptionId}/revoke`, {
    reason,
  });
  return response.data;
};
