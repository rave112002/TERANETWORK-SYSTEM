import { axiosInstance } from "../axios";

export const loginSuperAdminApi = async (payload) => {
  const response = await axiosInstance.post(
    "/api/v1/superadmin/auth/login",
    payload,
  );
  return response.data;
};

export const logoutSuperAdminApi = async () => {
  const response = await axiosInstance.post("/api/v1/superadmin/auth/logout");
  return response.data;
};

export const refreshTokenApi = async (token) => {
  const response = await axiosInstance.post("/api/v1/superadmin/auth/refresh", {
    token,
  });
  return response.data;
};

export const getCsrfTokenApi = async () => {
  const response = await axiosInstance.get(
    "/api/v1/superadmin/auth/csrf-token",
  );
  return response.data;
};
