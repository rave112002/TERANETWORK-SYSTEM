import { axiosInstance } from "../axios";

export const loginAdminApi = async (payload) => {
  const response = await axiosInstance.post(
    "/api/v1/admin/auth/login",
    payload,
  );
  return response.data;
};

export const logoutAdminApi = async () => {
  const response = await axiosInstance.post("/api/v1/admin/auth/logout");
  return response.data;
};

export const refreshTokenApi = async (token) => {
  const response = await axiosInstance.post("/api/v1/admin/auth/refresh", {
    token,
  });
  return response.data;
};

export const getCsrfTokenApi = async () => {
  const response = await axiosInstance.get("/api/v1/admin/auth/csrf-token");
  return response.data;
};
