import { axiosInstance, getUserToken, userTypeAuth } from "../axios";

export const loginAdminApi = async (payload) => {
  const response = await axiosInstance.post(
    "/api/v1/admin/auth/login",
    payload,
  );
  return response.data;
};

export const logoutAdminApi = async () => {
  // Send the refresh token so the backend can revoke it server-side
  const refreshToken = getUserToken(userTypeAuth.admin)?.refreshToken;
  const response = await axiosInstance.post(
    "/api/v1/admin/auth/logout",
    refreshToken ? { refreshToken } : {},
  );
  return response.data;
};

export const refreshTokenApi = async (refreshToken) => {
  const response = await axiosInstance.post("/api/v1/admin/auth/refresh", {
    refreshToken,
  });
  return response.data;
};

export const getCsrfTokenApi = async () => {
  const response = await axiosInstance.get("/api/v1/admin/auth/csrf-token");
  return response.data;
};
