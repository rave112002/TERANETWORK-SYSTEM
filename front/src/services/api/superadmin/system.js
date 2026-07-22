import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);

export const getSystemInfoApi = async () => {
  const response = await api.get("/api/v1/superadmin/system-info");
  return response.data;
};
