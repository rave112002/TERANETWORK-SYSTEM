import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

export const getSettingsApi = async () => {
  const response = await api.get("/api/v1/admin/settings");
  return response.data;
};

export const updateSettingsApi = async (payload) => {
  const response = await api.put("/api/v1/admin/settings", payload);
  return response.data;
};
