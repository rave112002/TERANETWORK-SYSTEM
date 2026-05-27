/**
 * Filter navigation items based on user permissions
 * @param {Array} navigation - Array of navigation items
 * @param {Function} hasPermission - Permission check function
 * @returns {Array} Filtered navigation items
 */
export const filterNavigationByPermissions = (navigation, hasPermission) => {
  return navigation
    .filter((item) => {
      // If no permission required, show item
      if (!item.permission) return true;

      // Handle anyOf permission structure (for parent modules with multiple submodules)
      if (item.permission.anyOf) {
        return item.permission.anyOf.some(
          ({ module, submodule, accessLevel }) =>
            hasPermission(module, submodule, accessLevel),
        );
      }

      // Handle single permission structure
      const { module, submodule, accessLevel } = item.permission;
      return hasPermission(module, submodule, accessLevel);
    })
    .map((item) => {
      // Recursively filter children if they exist
      if (item.children) {
        return {
          ...item,
          children: filterNavigationByPermissions(item.children, hasPermission),
        };
      }
      return item;
    });
};
