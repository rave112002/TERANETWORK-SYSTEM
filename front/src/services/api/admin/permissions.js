import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const axiosInstance = createAxiosInstanceWithInterceptor(
  "data",
  userTypeAuth.admin,
);

/**
 * Get all permissions
 */
export const getPermissions = async (params = {}) => {
  const { data } = await axiosInstance.get("/api/v1/admin/permissions", {
    params,
  });
  return data;
};

/**
 * Get list of modules
 */
export const getModules = async () => {
  const { data } = await axiosInstance.get("/api/v1/admin/permissions/modules");
  return data;
};

/**
 * Get current user's permissions
 */
export const getUserPermissions = async () => {
  const { data } = await axiosInstance.get("/api/v1/admin/permissions/user");
  return data.data;
};

/**
 * Check if user has specific permission
 */
export const checkPermission = async (module, submodule, accessLevel) => {
  const { data } = await axiosInstance.post("/api/v1/admin/permissions/check", {
    module,
    submodule,
    accessLevel,
  });
  return data;
};
