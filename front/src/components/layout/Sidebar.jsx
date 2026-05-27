import { App, Drawer, Popover, Tooltip } from "antd";
import clsx from "clsx";
import { ChevronDown, ChevronRight, LogOut, Settings } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "react-router";
import { logo } from "../../assets/images/logos";
import { useWindowSize } from "../../hooks/useWindowSize";

// Shared widths — imported by BasicLayout so the content offset stays in sync.
export const SIDEBAR_WIDTH = 256;
export const RAIL_WIDTH = 72;

const isRouteActive = (pathname, route) =>
  pathname === route || pathname.startsWith(route + "/");

// ── Leaf nav item ────────────────────────────────────────────────────────────
const NavItem = ({ item, isActive, onClick, depth = 0, collapsed = false }) => {
  const node = (
    <Link to={item.route} onClick={onClick} className="block no-underline">
      <div
        className={clsx("nav-item", isActive && "is-active", collapsed && "justify-center")}
        style={depth === 1 && !collapsed ? { paddingLeft: "2.25rem" } : undefined}
      >
        {item.icon && (
          <span className="shrink-0 flex items-center justify-center w-4 h-4">
            {item.icon}
          </span>
        )}
        {!collapsed && (
          <span className="text-sm flex-1 truncate">{item.label}</span>
        )}
        {!collapsed && isActive && (
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ backgroundColor: "var(--color-primary-color)" }}
          />
        )}
      </div>
    </Link>
  );

  return collapsed ? (
    <Tooltip title={item.label} placement="right">
      {node}
    </Tooltip>
  ) : (
    node
  );
};

// ── Group nav item ───────────────────────────────────────────────────────────
const NavGroup = ({ item, pathname, onNavigate, collapsed = false }) => {
  const hasActiveChild = item.children?.some((c) =>
    isRouteActive(pathname, c.route),
  );
  const [open, setOpen] = useState(hasActiveChild);

  // Collapsed rail → group becomes a hover flyout listing its children
  if (collapsed) {
    return (
      <Popover
        placement="rightTop"
        trigger="hover"
        styles={{ body: { padding: "0.375rem" } }}
        content={
          <div className="min-w-[180px]">
            <div
              className="px-2 pb-1.5 mb-1 text-xs font-semibold uppercase tracking-wide"
              style={{
                color: "var(--color-text-muted)",
                borderBottom: "1px solid var(--color-border)",
              }}
            >
              {item.label}
            </div>
            {item.children.map((child) => (
              <NavItem
                key={child.route}
                item={child}
                isActive={isRouteActive(pathname, child.route)}
                onClick={onNavigate}
              />
            ))}
          </div>
        }
      >
        <div className={clsx("nav-item justify-center", hasActiveChild && "is-active")}>
          {item.icon && (
            <span className="shrink-0 flex items-center justify-center w-4 h-4">
              {item.icon}
            </span>
          )}
        </div>
      </Popover>
    );
  }

  return (
    <div className="mb-0.5">
      <div
        className={clsx("nav-item select-none", hasActiveChild && "is-active")}
        onClick={() => setOpen((o) => !o)}
      >
        {item.icon && (
          <span className="shrink-0 flex items-center justify-center w-4 h-4">
            {item.icon}
          </span>
        )}
        <span className="text-sm flex-1 truncate">{item.label}</span>
        <span style={{ color: "var(--color-text-muted)" }}>
          {open ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </div>

      {open && (
        <div
          className="overflow-hidden relative pb-1 mt-0.5"
          style={{
            backgroundColor: "var(--color-surface-sunken)",
            borderRadius: "0.5rem",
          }}
        >
          <div
            className="absolute left-5 top-1 bottom-1 w-px rounded-full"
            style={{ backgroundColor: "var(--color-border)" }}
          />
          {item.children.map((child) => (
            <NavItem
              key={child.route}
              item={child}
              isActive={isRouteActive(pathname, child.route)}
              onClick={onNavigate}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// ── Nav list ─────────────────────────────────────────────────────────────────
const NavList = ({ navigations, pathname, onNavigate, collapsed }) => (
  <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-0.5">
    {navigations
      .filter((n) => n.isShow)
      .map((item) =>
        item.children?.length ? (
          <NavGroup
            key={item.key || item.route}
            item={item}
            pathname={pathname}
            onNavigate={onNavigate}
            collapsed={collapsed}
          />
        ) : (
          <NavItem
            key={item.route}
            item={item}
            isActive={isRouteActive(pathname, item.route)}
            onClick={onNavigate}
            collapsed={collapsed}
          />
        ),
      )}
  </nav>
);

// ── Bottom actions ────────────────────────────────────────────────────────────
const BottomActions = ({ basePath, onNavigate, onLogout, collapsed }) => {
  const { modal } = App.useApp();
  const location = useLocation();
  const isSettings = location.pathname.includes("account-settings");

  const confirmLogout = () =>
    modal.confirm({
      title: "Logout",
      content: "Do you want to logout?",
      okText: "Yes",
      cancelText: "No",
      okButtonProps: { danger: true },
      onOk: onLogout,
    });

  const settingsItem = (
    <Link
      to={`${basePath}/account-settings`}
      onClick={onNavigate}
      className="block no-underline"
    >
      <div
        className={clsx(
          "nav-item",
          isSettings && "is-active",
          collapsed && "justify-center",
        )}
      >
        <Settings className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="text-sm">Account Settings</span>}
      </div>
    </Link>
  );

  const logoutItem = (
    <div
      className={clsx("nav-item nav-item-danger", collapsed && "justify-center")}
      onClick={confirmLogout}
    >
      <LogOut className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="text-sm">Logout</span>}
    </div>
  );

  return (
    <div
      className="shrink-0 border-t pt-2 pb-3 px-2 space-y-0.5"
      style={{ borderColor: "var(--color-border)" }}
    >
      {collapsed ? (
        <Tooltip title="Account Settings" placement="right">
          {settingsItem}
        </Tooltip>
      ) : (
        settingsItem
      )}
      {collapsed ? (
        <Tooltip title="Logout" placement="right">
          {logoutItem}
        </Tooltip>
      ) : (
        logoutItem
      )}
    </div>
  );
};

// ── Sidebar shell ─────────────────────────────────────────────────────────────
const SidebarShell = ({
  navigations,
  pathname,
  basePath,
  onNavigate,
  onLogout,
  collapsed = false,
  organizationLogo,
}) => (
  <div
    className="theme-transition flex flex-col h-full"
    style={{
      backgroundColor: "var(--color-surface)",
      borderRight: "1px solid var(--color-border)",
    }}
  >
    {/* Logo — aligned to the 64px topbar height */}
    <div
      className="shrink-0 flex items-center justify-center px-3 h-16 border-b"
      style={{ borderColor: "var(--color-border)" }}
    >
      <img
        src={organizationLogo || logo}
        alt="Logo"
        style={{
          maxWidth: collapsed ? 32 : 120,
          maxHeight: collapsed ? 32 : 40,
          objectFit: "contain",
          display: "block",
          transition: "max-width 0.2s ease",
        }}
      />
    </div>

    <NavList
      navigations={navigations}
      pathname={pathname}
      onNavigate={onNavigate}
      collapsed={collapsed}
    />

    <BottomActions
      basePath={basePath}
      onNavigate={onNavigate}
      onLogout={onLogout}
      collapsed={collapsed}
    />
  </div>
);

// ── Main export ───────────────────────────────────────────────────────────────
const Sidebar = ({
  collapsed,
  handleCollapse,
  navigations,
  handleLogout,
  organization = null,
}) => {
  const { width } = useWindowSize();
  const location = useLocation();
  const pathname = location.pathname;

  const basePath = pathname.startsWith("/admin") ? "/admin" : "/superadmin";

  const close = () => handleCollapse(false);

  // Mobile → off-canvas drawer (collapsed === open)
  if (width <= 992) {
    return (
      <Drawer
        placement="left"
        onClose={close}
        open={collapsed}
        width={280}
        styles={{ body: { padding: 0 }, header: { display: "none" } }}
      >
        <SidebarShell
          navigations={navigations}
          pathname={pathname}
          basePath={basePath}
          onNavigate={close}
          onLogout={handleLogout}
          organizationLogo={organization?.organizationLogo}
        />
      </Drawer>
    );
  }

  // Desktop → fixed; collapsed === mini-rail
  const railWidth = collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH;

  return (
    <div
      className="hidden md:flex flex-col h-screen fixed left-0 top-0 overflow-hidden"
      style={{
        width: railWidth,
        minWidth: railWidth,
        transition: "width 0.2s ease, min-width 0.2s ease",
        zIndex: 100,
      }}
    >
      <SidebarShell
        navigations={navigations}
        pathname={pathname}
        basePath={basePath}
        onNavigate={() => {}}
        onLogout={handleLogout}
        collapsed={collapsed}
        organizationLogo={organization?.organizationLogo}
      />
    </div>
  );
};

export default Sidebar;
