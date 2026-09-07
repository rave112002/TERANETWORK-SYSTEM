import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);

export const getSuperAdminUsersApi = async (filters = {}) => {
  const response = await api.get("/api/v1/superadmin/users", {
    params: filters,
  });
  return response.data;
};

export const createSuperAdminUserApi = async (userData) => {
  const response = await api.post("/api/v1/superadmin/users", userData);
  return response.data;
};

/**
 * The branches a user is assigned to. Assignment — not the single `branchId`
 * column — is what decides which branches' data the user can read.
 */
export const getUserBranchesApi = async (accountId) => {
  const response = await api.get(
    `/api/v1/superadmin/users/${accountId}/branches`,
  );
  return response.data;
};

/** Replace a user's branch assignments. The first entry becomes their home branch. */
export const updateUserBranchesApi = async (accountId, branchIds) => {
  const response = await api.put(
    `/api/v1/superadmin/users/${accountId}/branches`,
    { branchIds },
  );
  return response.data;
};
