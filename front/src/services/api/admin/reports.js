import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Reports and the operations summary.
 *
 * Every report takes the same filters on screen and as a download, because the
 * same query serves both — an export that disagrees with the page it came from
 * is worse than no export.
 */

export const getOperationsSummaryApi = async () => {
  const response = await api.get("/api/v1/admin/reports/operations");
  return response.data;
};

/** @param {{asOf?: string}} filters */
export const getAgingReportApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/reports/aging", { params: filters });
  return response.data;
};

/** @param {{from?: string, to?: string}} filters */
export const getCollectionsReportApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/reports/collections", { params: filters });
  return response.data;
};

/** @param {{status?: string}} filters */
export const getSubscriberReportApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/reports/subscribers", { params: filters });
  return response.data;
};

/**
 * Download a report as CSV.
 *
 * `responseType: "blob"` on this call only — the shared instance unwraps JSON,
 * and letting it parse a CSV yields a mangled string that fails silently at
 * save time rather than loudly here.
 *
 * @param {'aging'|'collections'|'subscribers'} report
 * @param {Object} filters the same filters the screen is showing.
 */
export const downloadReportCsvApi = async (report, filters = {}) => {
  const response = await api.get(`/api/v1/admin/reports/${report}`, {
    params: { ...filters, format: "csv" },
    responseType: "blob",
  });
  return response;
};
