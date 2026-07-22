import { axiosInstance, getUserToken, userTypeAuth } from "../axios";

export const loginSuperAdminApi = async (payload) => {
  const response = await axiosInstance.post(
    "/api/v1/superadmin/auth/login",
    payload,
  );
  return response.data;
};

export const logoutSuperAdminApi = async () => {
  // Send the refresh token so the backend can revoke it server-side
  const refreshToken = getUserToken(userTypeAuth.superadmin)?.refreshToken;
  const response = await axiosInstance.post(
    "/api/v1/superadmin/auth/logout",
    refreshToken ? { refreshToken } : {},
  );
  return response.data;
};

export const refreshTokenApi = async (refreshToken) => {
  const response = await axiosInstance.post("/api/v1/superadmin/auth/refresh", {
    refreshToken,
  });
  return response.data;
};

export const getCsrfTokenApi = async () => {
  const response = await axiosInstance.get(
    "/api/v1/superadmin/auth/csrf-token",
  );
  return response.data;
};
