import { axiosInstance, createAxiosInstanceWithInterceptor } from "./axios";

// ─── Public (no auth) — CSRF is auto-handled by the axiosInstance interceptor ──

export const forgotPasswordApi = async (portal, email) => {
  const response = await axiosInstance.post(
    `/api/v1/${portal}/auth/forgot-password`,
    { email },
  );
  return response.data;
};

export const resetPasswordApi = async (portal, { token, password }) => {
  const response = await axiosInstance.post(
    `/api/v1/${portal}/auth/reset-password`,
    { token, password },
  );
  return response.data;
};

// ─── Authenticated (self-service profile) ─────────────────────────────────────

// portal is "admin" | "superadmin", which also selects the auth token instance
const authed = (portal) => createAxiosInstanceWithInterceptor("data", portal);

export const getMeApi = async (portal) => {
  const response = await authed(portal).get(`/api/v1/${portal}/auth/me`);
  return response.data;
};

export const updateProfileApi = async (portal, payload) => {
  const response = await authed(portal).put(`/api/v1/${portal}/auth/me`, payload);
  return response.data;
};

export const changePasswordApi = async (portal, payload) => {
  const response = await authed(portal).put(
    `/api/v1/${portal}/auth/me/password`,
    payload,
  );
  return response.data;
};
