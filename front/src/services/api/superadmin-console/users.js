import client from "./client";

/**
 * A branch's logins, managed on that branch through superadmin-server (D10).
 */

export const getBranchUsersApi = async (branchId) => {
  const response = await client.get(`/branches/${branchId}/users`);
  return response.data;
};

/** @param {{branchId: string, firstName: string, lastName: string, email: string, phone?: string|null, role: "Owner"|"Admin", password: string}} data */
export const createBranchUserApi = async ({ branchId, ...data }) => {
  const response = await client.post(`/branches/${branchId}/users`, data);
  return response.data;
};

/** @param {{branchId: string, accountId: string, password: string}} args */
export const resetBranchUserPasswordApi = async ({ branchId, accountId, password }) => {
  const response = await client.put(`/branches/${branchId}/users/${accountId}/password`, { password });
  return response.data;
};

/** @param {{branchId: string, accountId: string, status: "Active"|"Inactive"}} args */
export const setBranchUserStatusApi = async ({ branchId, accountId, status }) => {
  const response = await client.put(`/branches/${branchId}/users/${accountId}/status`, { status });
  return response.data;
};
