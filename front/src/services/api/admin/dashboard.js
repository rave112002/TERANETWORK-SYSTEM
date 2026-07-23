import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

export const getDashboardStatsApi = async () => {
  const response = await api.get("/api/v1/admin/dashboard/stats");
  return response.data;
};
