import client from "./client";

/** The branches this SuperAdmin manages. Keys are never returned. */
export const getBranchesApi = async () => {
  const response = await client.get("/branches");
  return response.data;
};

/**
 * One branch's live health, checked through superadmin-server. Always 200:
 * an unreachable branch comes back as `status: "offline"`, not as an error.
 */
export const getBranchHealthApi = async (branchId) => {
  const response = await client.get(`/branches/${branchId}/health`);
  return response.data;
};

/** @param {{name: string, baseUrl: string, apiKey: string}} data */
export const createBranchApi = async (data) => {
  const response = await client.post("/branches", data);
  return response.data;
};

/** @param {{branchId: string, name: string, baseUrl: string, apiKey?: string}} data  blank apiKey keeps the stored one */
export const updateBranchApi = async ({ branchId, ...data }) => {
  const response = await client.put(`/branches/${branchId}`, data);
  return response.data;
};

export const deleteBranchApi = async (branchId) => {
  const response = await client.delete(`/branches/${branchId}`);
  return response.data;
};
