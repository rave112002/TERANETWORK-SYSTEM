import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

// GET /api/v1/admin/audit-trail
// filters: { page, pageSize, search, module, accountId, startDate, endDate, sortOrder }
export const getAuditTrailApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/audit-trail", {
    params: filters,
  });
  return response.data;
};

// GET /api/v1/admin/audit-trail/:auditId — full detail (includes userAgent)
export const getAuditDetailApi = async (auditId) => {
  const response = await api.get(`/api/v1/admin/audit-trail/${auditId}`);
  return response.data;
};

// GET /api/v1/admin/audit-trail/export — CSV of the current filter selection
export const exportAuditTrailApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/audit-trail/export", {
    params: filters,
    responseType: "blob",
  });
  return response;
};
