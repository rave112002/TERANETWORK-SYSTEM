import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * OLTs — network inventory.
 *
 * Scoped server-side to the branches the signed-in user is assigned to.
 * Device credentials are write-only: the API accepts a `credentials`
 * object and never returns one. Rows carry a `hasCredentials` flag instead.
 */
export const getOltsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/network/olts", { params: filters });
  return response.data;
};

export const getOltByIdApi = async (oltId) => {
  const response = await api.get(`/api/v1/admin/network/olts/${oltId}`);
  return response.data;
};

export const createOltApi = async (data) => {
  const response = await api.post("/api/v1/admin/network/olts", data);
  return response.data;
};

export const updateOltApi = async (oltId, data) => {
  const response = await api.put(`/api/v1/admin/network/olts/${oltId}`, data);
  return response.data;
};

export const deleteOltApi = async (oltId) => {
  const response = await api.delete(`/api/v1/admin/network/olts/${oltId}`);
  return response.data;
};
