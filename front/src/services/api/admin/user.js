import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

export const getUsersApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/users", { params: filters });
  return response.data;
};

export const getUserByIdApi = async (userId) => {
  const response = await api.get(`/api/v1/admin/users/${userId}`);
  return response.data;
};

export const createUserApi = async (userData) => {
  const response = await api.post("/api/v1/admin/users", userData);
  return response.data;
};

export const updateUserApi = async (userId, userData) => {
  const response = await api.put(`/api/v1/admin/users/${userId}`, userData);
  return response.data;
};

export const deleteUserApi = async (userId) => {
  const response = await api.delete(`/api/v1/admin/users/${userId}`);
  return response.data;
};
