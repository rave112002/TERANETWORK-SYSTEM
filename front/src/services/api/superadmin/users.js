import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);

export const getSuperAdminUsersApi = async (filters = {}) => {
  const response = await api.get("/api/v1/superadmin/users", {
    params: filters,
  });
  return response.data;
};

export const createSuperAdminUserApi = async (userData) => {
  const response = await api.post("/api/v1/superadmin/users", userData);
  return response.data;
};
