import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { useLocation } from "react-router";
import { getUserPermissions } from "../services/api/admin/permissions";

/**
 * Hook for checking user permissions.
 * Only fetches on Admin portal — SuperAdmin has full access (no granular permissions).
 *
 * The helpers and returned object are memoized so consumers (ProtectedRoute, page
 * hooks, sidebar) get stable references and don't re-render / recompute on every render.
 */
export const usePermissions = () => {
  const location = useLocation();
  const isSuperAdmin = location.pathname.startsWith("/superadmin");

  const { data, isLoading, error } = useQuery({
    queryKey: ["userPermissions"],
    queryFn: getUserPermissions,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    enabled: !isSuperAdmin, // Skip fetching on SuperAdmin portal
  });

  // Stable array reference while `data` is unchanged.
  const permissions = useMemo(() => data?.permissions || [], [data]);

  /**
   * Check if user has specific permission.
   * SuperAdmin always returns true (full access).
   */
  const hasPermission = useCallback(
    (module, submodule = null, accessLevel = "read") => {
      if (isSuperAdmin) return true;

      const permission = permissions.find(
        (p) => p.module === module && p.submodule === submodule,
      );

      if (!permission) return false;

      const accessLevels = { none: 0, read: 1, write: 2 };
      return accessLevels[permission.accessLevel] >= accessLevels[accessLevel];
    },
    [isSuperAdmin, permissions],
  );

  /**
   * Check if user has module access
   */
  const hasModuleAccess = useCallback(
    (module) => {
      if (isSuperAdmin) return true;
      return permissions.some(
        (p) => p.module === module && p.submodule === null,
      );
    },
    [isSuperAdmin, permissions],
  );

  /**
   * Check if user has any permission in a submodule
   */
  const hasSubmoduleAccess = useCallback(
    (module, submodule) => {
      if (isSuperAdmin) return true;
      return permissions.some(
        (p) => p.module === module && p.submodule === submodule,
      );
    },
    [isSuperAdmin, permissions],
  );

  /**
   * Get all permissions for a module
   */
  const getModulePermissions = useCallback(
    (module) => permissions.filter((p) => p.module === module),
    [permissions],
  );

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = useCallback(
    (perms) => {
      if (isSuperAdmin) return true;
      return perms.some(({ module, submodule, accessLevel }) =>
        hasPermission(module, submodule, accessLevel),
      );
    },
    [isSuperAdmin, hasPermission],
  );

  const role = useMemo(
    () =>
      data
        ? {
            roleId: data.roleId,
            roleName: data.roleName,
            description: data.description,
          }
        : null,
    [data],
  );

  return useMemo(
    () => ({
      permissions,
      role,
      hasPermission,
      hasModuleAccess,
      hasSubmoduleAccess,
      getModulePermissions,
      hasAnyPermission,
      isLoading: isSuperAdmin ? false : isLoading,
      error: isSuperAdmin ? null : error,
    }),
    [
      permissions,
      role,
      hasPermission,
      hasModuleAccess,
      hasSubmoduleAccess,
      getModulePermissions,
      hasAnyPermission,
      isSuperAdmin,
      isLoading,
      error,
    ],
  );
};
