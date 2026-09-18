import client from "./client";

/** A branch's runtime settings, read and saved on that branch (D10). */

export const getBranchSystemSettingsApi = async (branchId) => {
  const response = await client.get(`/branches/${branchId}/system-settings`);
  return response.data;
};

/** @param {{branchId: string} & Record<string, unknown>} args  partial: only what changes */
export const updateBranchSystemSettingsApi = async ({ branchId, ...updates }) => {
  const response = await client.put(`/branches/${branchId}/system-settings`, updates);
  return response.data;
};
