import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * NAPs — network inventory.
 *
 * Scoped server-side to the branches the signed-in user is assigned to.
 * GPS is required on every NAP — this list is what the network map
 * renders, so ask for a large `pageSize` when driving the map.
 */
export const getNapsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/network/naps", { params: filters });
  return response.data;
};

export const getNapByIdApi = async (napId) => {
  const response = await api.get(`/api/v1/admin/network/naps/${napId}`);
  return response.data;
};

export const createNapApi = async (data) => {
  const response = await api.post("/api/v1/admin/network/naps", data);
  return response.data;
};

export const updateNapApi = async (napId, data) => {
  const response = await api.put(`/api/v1/admin/network/naps/${napId}`, data);
  return response.data;
};

export const deleteNapApi = async (napId) => {
  const response = await api.delete(`/api/v1/admin/network/naps/${napId}`);
  return response.data;
};
