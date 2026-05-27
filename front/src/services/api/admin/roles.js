import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const axiosInstance = createAxiosInstanceWithInterceptor(
  "data",
  userTypeAuth.admin,
);

/**
 * Get all roles
 */
export const getRoles = async (params = {}) => {
  const { data } = await axiosInstance.get("/api/v1/admin/roles", { params });
  return data;
};

/**
 * Get single role
 */
export const getRole = async (roleId) => {
  const { data } = await axiosInstance.get(`/api/v1/admin/roles/${roleId}`);
  return data;
};

/**
 * Create new role
 */
export const createRole = async (roleData) => {
  const { data } = await axiosInstance.post("/api/v1/admin/roles", roleData);
  return data;
};

/**
 * Update role
 */
export const updateRole = async (roleId, roleData) => {
  const { data } = await axiosInstance.put(
    `/api/v1/admin/roles/${roleId}`,
    roleData,
  );
  return data;
};

/**
 * Delete role
 */
export const deleteRole = async (roleId) => {
  const { data } = await axiosInstance.delete(`/api/v1/admin/roles/${roleId}`);
  return data;
};

/**
 * Get role permissions
 */
export const getRolePermissions = async (roleId) => {
  const { data } = await axiosInstance.get(
    `/api/v1/admin/roles/${roleId}/permissions`,
  );
  return data;
};

/**
 * Assign permissions to role
 */
export const assignPermissions = async (roleId, permissions) => {
  const { data } = await axiosInstance.post(
    `/api/v1/admin/roles/${roleId}/permissions`,
    {
      permissions,
    },
  );
  return data;
};
