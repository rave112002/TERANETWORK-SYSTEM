import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * PON ports — network inventory.
 *
 * Scoped server-side to the branches the signed-in user is assigned to.
 * A port's OLT is fixed at creation — moving one would silently
 * re-parent every splitter, NAP and ONU beneath it.
 */
export const getPonPortsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/network/pon-ports", { params: filters });
  return response.data;
};

export const getPonPortByIdApi = async (ponPortId) => {
  const response = await api.get(`/api/v1/admin/network/pon-ports/${ponPortId}`);
  return response.data;
};

export const createPonPortApi = async (data) => {
  const response = await api.post("/api/v1/admin/network/pon-ports", data);
  return response.data;
};

export const updatePonPortApi = async (ponPortId, data) => {
  const response = await api.put(`/api/v1/admin/network/pon-ports/${ponPortId}`, data);
  return response.data;
};

export const deletePonPortApi = async (ponPortId) => {
  const response = await api.delete(`/api/v1/admin/network/pon-ports/${ponPortId}`);
  return response.data;
};
