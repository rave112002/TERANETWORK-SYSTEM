import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * splitters — network inventory.
 *
 * Scoped server-side to the branches the signed-in user is assigned to.
 * The parent is polymorphic (`parentType` is `pon_port` or `splitter`),
 * so the form sends a type alongside the id.
 */
export const getSplittersApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/network/splitters", { params: filters });
  return response.data;
};

export const getSplitterByIdApi = async (splitterId) => {
  const response = await api.get(`/api/v1/admin/network/splitters/${splitterId}`);
  return response.data;
};

export const createSplitterApi = async (data) => {
  const response = await api.post("/api/v1/admin/network/splitters", data);
  return response.data;
};

export const updateSplitterApi = async (splitterId, data) => {
  const response = await api.put(`/api/v1/admin/network/splitters/${splitterId}`, data);
  return response.data;
};

export const deleteSplitterApi = async (splitterId) => {
  const response = await api.delete(`/api/v1/admin/network/splitters/${splitterId}`);
  return response.data;
};
