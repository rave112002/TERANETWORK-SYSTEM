import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * ONUs — network inventory.
 *
 * Scoped server-side to the branches the signed-in user is assigned to.
 * `provisioningState` is owned by the provisioning worker and cannot be
 * set through these endpoints; `recordStatus` is the inventory flag staff edit.
 */
export const getOnusApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/network/onus", { params: filters });
  return response.data;
};

export const getOnuByIdApi = async (onuId) => {
  const response = await api.get(`/api/v1/admin/network/onus/${onuId}`);
  return response.data;
};

export const createOnuApi = async (data) => {
  const response = await api.post("/api/v1/admin/network/onus", data);
  return response.data;
};

export const updateOnuApi = async (onuId, data) => {
  const response = await api.put(`/api/v1/admin/network/onus/${onuId}`, data);
  return response.data;
};

export const deleteOnuApi = async (onuId) => {
  const response = await api.delete(`/api/v1/admin/network/onus/${onuId}`);
  return response.data;
};
