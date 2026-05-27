/**
 * Generate menu item for Ant Design Menu
 */
export function getItem(label, key, icon, children, type) {
  return {
    key,
    icon,
    children,
    label,
    type,
  };
}

/**
 * Generate menu items from navigation array
 */
export function generateItems(navigations = []) {
  return navigations
    .filter((nav) => nav.isShow)
    .map((nav) => {
      if (nav.children && nav.children.length > 0) {
        return getItem(
          nav.label,
          nav.key || nav.route,
          nav.icon,
          generateItems(nav.children),
        );
      }
      return getItem(nav.label, nav.route, nav.icon);
    });
}
