import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Discovery — sweeping an OLT and importing what it found.
 *
 * A sweep changes nothing: it reads the device and stages a comparison.
 * Importing is the separate, deliberate call.
 */

/** @param {{oltId: string}} body */
export const runDiscoveryApi = async (body) => {
  const response = await api.post("/api/v1/admin/network/discovery/runs", body);
  return response.data;
};

export const getDiscoveryRunsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/network/discovery/runs", { params: filters });
  return response.data;
};

export const getDiscoveryRunApi = async (discoveryRunId) => {
  const response = await api.get(`/api/v1/admin/network/discovery/runs/${discoveryRunId}`);
  return response.data;
};

export const getDiscoveredItemsApi = async (discoveryRunId, filters = {}) => {
  const response = await api.get(
    `/api/v1/admin/network/discovery/runs/${discoveryRunId}/items`,
    { params: filters },
  );
  return response.data;
};

/**
 * Every field overrides what the sweep guessed. `provisioningState` is
 * deliberately not among them — it comes from what the device actually
 * reported.
 */
export const importDiscoveredItemApi = async (discoveredItemId, overrides = {}) => {
  const response = await api.post(
    `/api/v1/admin/network/discovery/items/${discoveredItemId}/import`,
    overrides,
  );
  return response.data;
};
