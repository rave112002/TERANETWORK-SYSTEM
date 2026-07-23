import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);

export const getDashboardStatsApi = async () => {
  const response = await api.get("/api/v1/superadmin/dashboard/stats");
  return response.data;
};
