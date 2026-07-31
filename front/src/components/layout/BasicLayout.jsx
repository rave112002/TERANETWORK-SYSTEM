import { PanelLeftClose, PanelLeftOpen, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useMemo, useState } from "react";
import { Outlet, useLocation } from "react-router";
import ThemeToggle from "../ThemeToggle";
import { usePermissions } from "../../hooks/usePermissions";
import { useWindowSize } from "../../hooks/useWindowSize";
import { filterNavigationByPermissions } from "../../utils/filterNavigation";
import Sidebar, { RAIL_WIDTH, SIDEBAR_WIDTH } from "./Sidebar";

// Derive a readable page title from the current pathname + nav tree
const getPageTitle = (pathname, navigations) => {
  for (const nav of navigations) {
    if (nav.children) {
      for (const child of nav.children) {
        if (
          pathname === child.route ||
          pathname.startsWith(child.route + "/")
        ) {
          return { group: nav.label, title: child.label };
        }
      }
    } else if (pathname === nav.route || pathname.startsWith(nav.route + "/")) {
      return { group: null, title: nav.label };
    }
  }
  return { group: null, title: "Dashboard" };
};

const BasicLayout = ({ navigations, store }) => {
  // On desktop `collapsed` = mini-rail; on mobile it = drawer-open.
  const [collapsed, setCollapsed] = useState(false);
  const { width } = useWindowSize();
  const { company, userData, reset } = store();
  const { hasPermission, isLoading } = usePermissions();
  const location = useLocation();

  const isMobile = width < 992;

  const filteredNavigations = useMemo(() => {
    if (isLoading) return [];
    return filterNavigationByPermissions(navigations, hasPermission);
  }, [navigations, hasPermission, isLoading]);

  const { group, title } = getPageTitle(location.pathname, filteredNavigations);

  const handleCollapse = (value) => setCollapsed(value);

  // Content offset matches the sidebar: hidden on mobile, rail or full on desktop
  const contentMargin = isMobile ? 0 : collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH;

  return (
    <div
      className="flex h-screen w-screen overflow-hidden"
      style={{ backgroundColor: "var(--color-canvas)" }}
    >
      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        handleCollapse={handleCollapse}
        navigations={filteredNavigations}
        handleLogout={reset}
        userData={userData}
        company={company}
      />

      {/* Main area */}
      <div
        className="flex flex-col flex-1 min-w-0 h-screen overflow-hidden transition-all duration-200"
        style={{ marginLeft: contentMargin }}
      >
        {/* Topbar — clean surface bar with a hairline border (theme-aware) */}
        <header
          className="theme-transition shrink-0 flex items-center justify-between px-4 md:px-6 h-16 z-30"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          {/* Left — toggle + breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="icon-btn w-9 h-9 shrink-0"
              aria-label="Toggle navigation"
              onClick={() => handleCollapse(!collapsed)}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4.5 h-4.5" />
              ) : (
                <PanelLeftClose className="w-4.5 h-4.5" />
              )}
            </button>

            <div className="flex items-center gap-1.5 min-w-0">
              {group && (
                <>
                  <span
                    className="text-xs truncate hidden sm:block"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {group}
                  </span>
                  <span
                    className="hidden sm:block"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    /
                  </span>
                </>
              )}
              <span
                className="text-base font-semibold truncate"
                style={{ color: "var(--color-text-dark)" }}
              >
                {title}
              </span>
            </div>
          </div>

          {/* Right — theme toggle + user */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <ThemeToggle />

            {/* divider */}
            <span
              className="hidden sm:block w-px h-6 mx-1"
              style={{ backgroundColor: "var(--color-border)" }}
            />

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-lg transition-colors hover:bg-(--color-surface-sunken)"
                  style={{ color: "var(--color-text-dark)" }}
                >
                  <Avatar className="size-8 shrink-0">
                    <AvatarFallback
                      style={{
                        background: "var(--gradient-primary)",
                        color: "#fff",
                      }}
                    >
                      <User className="w-4 h-4" />
                    </AvatarFallback>
                  </Avatar>
                  {width > 640 && (
                    <span className="text-sm font-medium max-w-35 truncate text-left leading-tight">
                      {userData &&
                        [userData.firstName, userData.lastName].join(" ")}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-50">
                <div className="px-2 py-1.5">
                  <div
                    className="font-semibold"
                    style={{ color: "var(--color-text-dark)" }}
                  >
                    {userData &&
                      [userData.firstName, userData.lastName].join(" ")}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "var(--color-text-secondary)" }}
                  >
                    {userData?.email}
                  </div>
                  {userData?.roleName && (
                    <div
                      className="text-xs mt-0.5 font-medium"
                      style={{ color: "var(--color-primary-color)" }}
                    >
                      {userData.roleName}
                    </div>
                  )}
                </div>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Page content */}
        <main
          className="theme-transition flex-1 overflow-auto"
          style={{ backgroundColor: "var(--color-canvas)" }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default BasicLayout;
