import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Get user permissions (role + user overrides)
 */
export const getUserPermissions = async (accountId) => {
  const { data } = await api.get(`/api/v1/admin/user-permissions/${accountId}`);
  return data;
};

/**
 * Set single user permission override
 */
export const setUserPermission = async (accountId, permissionData) => {
  const { data } = await api.post(
    `/api/v1/admin/user-permissions/${accountId}`,
    permissionData,
  );
  return data;
};

/**
 * Remove user permission override
 */
export const removeUserPermission = async (accountId, permissionId) => {
  const { data } = await api.delete(
    `/api/v1/admin/user-permissions/${accountId}/${permissionId}`,
  );
  return data;
};

/**
 * Bulk update user permissions
 */
export const bulkUpdateUserPermissions = async (accountId, permissions) => {
  const { data } = await api.post(
    `/api/v1/admin/user-permissions/${accountId}/bulk`,
    { permissions },
  );
  return data;
};
