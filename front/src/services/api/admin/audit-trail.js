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
