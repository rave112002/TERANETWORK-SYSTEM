import { App, Drawer, Dropdown, Popover, Tooltip } from "antd";
import clsx from "clsx";
import {
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  LogOut,
  Search,
  Settings,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { logo } from "../../assets/images/logos";
import { useWindowSize } from "../../hooks/useWindowSize";

// Shared widths — imported by BasicLayout so the content offset stays in sync.
export const SIDEBAR_WIDTH = 256;
export const RAIL_WIDTH = 72;

const isRouteActive = (pathname, route) =>
  pathname === route || pathname.startsWith(route + "/");

/**
 * Mac reports "MacIntel"/"macOS"; iPad/iPhone matter because an external
 * keyboard still sends ⌘. `userAgentData` is Chromium-only, so fall back through
 * the deprecated-but-universal `platform`, then the UA string.
 */
const detectIsMac = () => {
  if (typeof navigator === "undefined") return false;
  const platform =
    navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
};

// ── Search helpers ───────────────────────────────────────────────────────────
const visible = (items = []) => items.filter((i) => i.isShow);

/** Filter the nav tree by label. A group survives if it matches, or any child does. */
const filterNav = (navigations, query) => {
  const q = query.trim().toLowerCase();
  if (!q) return visible(navigations);

  const out = [];
  for (const item of visible(navigations)) {
    const selfMatch = item.label?.toLowerCase().includes(q);
    if (item.children?.length) {
      const kids = visible(item.children);
      const matched = kids.filter((c) => c.label?.toLowerCase().includes(q));
      if (selfMatch) out.push({ ...item, children: kids });
      else if (matched.length) out.push({ ...item, children: matched });
    } else if (selfMatch) {
      out.push(item);
    }
  }
  return out;
};

/** Flatten to navigable leaves, in render order — drives ↑/↓ + Enter. */
const flattenLeaves = (navigations) =>
  navigations.flatMap((item) =>
    item.children?.length ? visible(item.children) : item.route ? [item] : [],
  );

// ── Brand ────────────────────────────────────────────────────────────────────
const Brand = ({ collapsed, companyLogo }) => {
  const name = import.meta.env.VITE_APP_NAME || "Workspace";
  return (
    <div
      className={clsx(
        "shrink-0 flex items-center gap-2.5 px-3 pt-4 pb-3",
        collapsed && "justify-center px-0",
      )}
    >
      <span
        className="inline-flex items-center justify-center shrink-0 overflow-hidden"
        style={{
          width: 34,
          height: 34,
          borderRadius: 9,
          background: "var(--color-surface-sunken)",
          border: "1px solid var(--color-line)",
        }}
      >
        <img
          src={companyLogo || logo}
          alt=""
          width={22}
          height={22}
          decoding="async"
          style={{ maxWidth: 22, maxHeight: 22, objectFit: "contain" }}
        />
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <div
            className="truncate font-semibold"
            style={{ fontSize: 14, color: "var(--color-text-dark)" }}
          >
            {name}
          </div>
          <div
            className="truncate"
            style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
          >
            Workspace
          </div>
        </div>
      )}
    </div>
  );
};

// ── Search ───────────────────────────────────────────────────────────────────
const SearchBox = ({ inputRef, query, onQuery, onKeyDown, showHint, isMac }) => (
  <div className="shrink-0 px-3 pb-3">
    <div
      className="flex items-center gap-2 transition-colors"
      style={{
        height: 34,
        padding: "0 8px 0 10px",
        borderRadius: 9,
        background: "var(--color-surface-sunken)",
        border: "1px solid var(--color-line)",
      }}
    >
      <Search
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: "var(--color-text-muted)" }}
      />
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Search..."
        aria-label="Search navigation"
        className="flex-1 min-w-0 bg-transparent outline-none border-none"
        style={{ fontSize: 13, color: "var(--color-text-dark)" }}
      />
      {showHint && !query && (
        <kbd
          className="shrink-0 font-mono select-none"
          style={{
            fontSize: 10,
            lineHeight: "16px",
            padding: "0 5px",
            borderRadius: 5,
            border: "1px solid var(--color-line)",
            background: "var(--color-surface)",
            color: "var(--color-text-muted)",
          }}
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      )}
    </div>
  </div>
);

// ── Leaf nav item ────────────────────────────────────────────────────────────
const NavItem = ({
  item,
  isActive,
  isHighlighted,
  onClick,
  nested = false,
  collapsed = false,
}) => {
  const node = (
    <Link to={item.route} onClick={onClick} className="block no-underline">
      <div
        className={clsx(
          "nav-item",
          isActive && "is-active",
          collapsed && "justify-center",
        )}
        style={{
          ...(nested ? { paddingLeft: 14 } : null),
          ...(isHighlighted && !isActive
            ? { background: "var(--color-surface-sunken)" }
            : null),
        }}
      >
        {item.icon && (
          <span className="shrink-0 flex items-center justify-center w-4 h-4">
            {item.icon}
          </span>
        )}
        {!collapsed && (
          <span className="text-sm flex-1 truncate">{item.label}</span>
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

// Top-level active items get the 2px accent bar; nested ones get it on the rail.
const TopLevelItem = (props) => (
  <div className="relative">
    {props.isActive && !props.collapsed && (
      <span
        className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
        style={{ background: "var(--color-secondary-color)" }}
      />
    )}
    <NavItem {...props} />
  </div>
);

// ── Group nav item ───────────────────────────────────────────────────────────
const NavGroup = ({
  item,
  pathname,
  onNavigate,
  collapsed = false,
  forceOpen = false,
  highlightRoute,
}) => {
  const hasActiveChild = item.children?.some((c) =>
    isRouteActive(pathname, c.route),
  );
  const [open, setOpen] = useState(hasActiveChild);

  // While searching, groups with matches are force-opened.
  const isOpen = forceOpen || open;

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
                borderBottom: "1px solid var(--color-line)",
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
        <div
          className={clsx(
            "nav-item justify-center",
            hasActiveChild && "is-active",
          )}
        >
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
    <div>
      <div
        className="nav-item select-none"
        style={isOpen ? { color: "var(--color-text2)" } : undefined}
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        {item.icon && (
          <span className="shrink-0 flex items-center justify-center w-4 h-4">
            {item.icon}
          </span>
        )}
        <span className="text-sm flex-1 truncate">{item.label}</span>
        <span style={{ color: "var(--color-text-muted)" }}>
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </span>
      </div>

      {isOpen && (
        <div className="relative mt-0.5" style={{ marginLeft: 22 }}>
          {/* rail */}
          <div
            className="absolute left-0 top-1 bottom-1 w-px"
            style={{ background: "var(--color-line)" }}
          />
          {item.children.map((child) => {
            const active = isRouteActive(pathname, child.route);
            return (
              <div className="relative" key={child.route}>
                {active && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full"
                    style={{ background: "var(--color-secondary-color)" }}
                  />
                )}
                <NavItem
                  item={child}
                  isActive={active}
                  isHighlighted={highlightRoute === child.route}
                  onClick={onNavigate}
                  nested
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ── Nav list ─────────────────────────────────────────────────────────────────
const NavSection = ({
  items,
  pathname,
  onNavigate,
  collapsed,
  searching,
  highlightRoute,
}) =>
  items.map((item) =>
    item.children?.length ? (
      <NavGroup
        key={item.key || item.route}
        item={item}
        pathname={pathname}
        onNavigate={onNavigate}
        collapsed={collapsed}
        forceOpen={searching}
        highlightRoute={highlightRoute}
      />
    ) : (
      <TopLevelItem
        key={item.route}
        item={item}
        isActive={isRouteActive(pathname, item.route)}
        isHighlighted={highlightRoute === item.route}
        onClick={onNavigate}
        collapsed={collapsed}
      />
    ),
  );

// ── User footer ──────────────────────────────────────────────────────────────
const UserFooter = ({ userData, basePath, onNavigate, onLogout, collapsed }) => {
  const { modal } = App.useApp();

  const fullName =
    [userData?.firstName, userData?.lastName].filter(Boolean).join(" ") ||
    "Account";
  const initials =
    [userData?.firstName?.[0], userData?.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

  const confirmLogout = () =>
    modal.confirm({
      title: "Logout",
      content: "Do you want to logout?",
      okText: "Yes",
      cancelText: "No",
      okButtonProps: { danger: true },
      onOk: onLogout,
    });

  const menuItems = [
    {
      key: "account",
      label: <Link to={`${basePath}/account-settings`}>Account settings</Link>,
      icon: <Settings className="w-4 h-4" />,
      onClick: onNavigate,
    },
    { type: "divider" },
    {
      key: "logout",
      label: "Logout",
      icon: <LogOut className="w-4 h-4" />,
      danger: true,
      onClick: confirmLogout,
    },
  ];

  const avatar = (
    <span
      className="inline-flex items-center justify-center shrink-0"
      style={{
        width: 30,
        height: 30,
        borderRadius: "50%",
        background: "var(--color-surface-sunken)",
        border: "1px solid var(--color-line)",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--color-text-secondary)",
      }}
    >
      {initials}
    </span>
  );

  return (
    <div
      className="shrink-0 px-2 py-2.5"
      style={{ borderTop: "1px solid var(--color-line)" }}
    >
      <Dropdown
        menu={{ items: menuItems }}
        trigger={["click"]}
        placement={collapsed ? "topRight" : "topLeft"}
      >
        <button
          className={clsx(
            "w-full flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-(--color-surface-sunken)",
            collapsed && "justify-center",
          )}
          aria-label="Account menu"
        >
          {avatar}
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1 text-left leading-tight">
                <span
                  className="block truncate"
                  style={{ fontSize: 13, fontWeight: 500, color: "var(--color-text-dark)" }}
                >
                  {fullName}
                </span>
                <span
                  className="block truncate"
                  style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
                >
                  {userData?.email}
                </span>
              </span>
              <ChevronsUpDown
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
            </>
          )}
        </button>
      </Dropdown>
    </div>
  );
};

// ── Sidebar shell ────────────────────────────────────────────────────────────
const SidebarShell = ({
  navigations,
  pathname,
  basePath,
  onNavigate,
  onLogout,
  collapsed = false,
  companyLogo,
  userData,
  onExpand,
  isMobile,
}) => {
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [pendingFocus, setPendingFocus] = useState(false);
  const isMac = useMemo(detectIsMac, []);

  const searching = query.trim().length > 0;
  const filtered = useMemo(() => filterNav(navigations, query), [navigations, query]);
  const leaves = useMemo(() => flattenLeaves(filtered), [filtered]);

  // Keep the highlight in range as results change.
  useEffect(() => setHighlight(0), [query]);

  const main = filtered.filter((i) => i.section !== "system");
  const system = filtered.filter((i) => i.section === "system");

  const go = useCallback(
    (route) => {
      setQuery("");
      navigate(route);
      onNavigate?.();
    },
    [navigate, onNavigate],
  );

  /**
   * Focus the search box. When the rail is collapsed the input isn't mounted
   * yet, so we can't focus synchronously — flag it and let the effect below
   * focus once React has committed the expanded sidebar.
   */
  const focusSearch = useCallback(() => {
    if (collapsed) {
      onExpand?.();
      setPendingFocus(true);
    } else {
      inputRef.current?.focus();
    }
  }, [collapsed, onExpand]);

  useEffect(() => {
    if (pendingFocus && !collapsed && inputRef.current) {
      inputRef.current.focus();
      setPendingFocus(false);
    }
  }, [pendingFocus, collapsed]);

  // ⌘K (mac) / Ctrl+K (windows, linux) → focus search.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === "k") {
        e.preventDefault();
        focusSearch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusSearch]);

  const onSearchKeyDown = (e) => {
    if (e.key === "Escape") {
      if (query) setQuery("");
      else inputRef.current?.blur();
      return;
    }
    if (!leaves.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((i) => (i + 1) % leaves.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((i) => (i - 1 + leaves.length) % leaves.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = leaves[highlight] || leaves[0];
      if (target?.route) go(target.route);
    }
  };

  const highlightRoute = searching ? leaves[highlight]?.route : null;

  return (
    <div
      className="theme-transition flex flex-col h-full"
      style={{
        backgroundColor: "var(--color-surface)",
        borderRight: "1px solid var(--color-line)",
      }}
    >
      <Brand collapsed={collapsed} companyLogo={companyLogo} />

      {collapsed ? (
        <div className="shrink-0 flex justify-center pb-3">
          <Tooltip title={`Search (${isMac ? "⌘K" : "Ctrl K"})`} placement="right">
            <button className="icon-btn w-9 h-9" aria-label="Search" onClick={focusSearch}>
              <Search className="w-4 h-4" />
            </button>
          </Tooltip>
        </div>
      ) : (
        <SearchBox
          inputRef={inputRef}
          query={query}
          onQuery={setQuery}
          onKeyDown={onSearchKeyDown}
          showHint={!isMobile}
          isMac={isMac}
        />
      )}

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-3 space-y-0.5">
        {searching && !leaves.length ? (
          <p
            className="px-2 py-6 text-center"
            style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
          >
            No results for “{query.trim()}”
          </p>
        ) : (
          <>
            <NavSection
              items={main}
              pathname={pathname}
              onNavigate={onNavigate}
              collapsed={collapsed}
              searching={searching}
              highlightRoute={highlightRoute}
            />

            {system.length > 0 && (
              <>
                <div
                  className="my-2 mx-1"
                  style={{ borderTop: "1px solid var(--color-line)" }}
                />
                <NavSection
                  items={system}
                  pathname={pathname}
                  onNavigate={onNavigate}
                  collapsed={collapsed}
                  searching={searching}
                  highlightRoute={highlightRoute}
                />
              </>
            )}
          </>
        )}
      </nav>

      <UserFooter
        userData={userData}
        basePath={basePath}
        onNavigate={onNavigate}
        onLogout={onLogout}
        collapsed={collapsed}
      />
    </div>
  );
};

// ── Main export ──────────────────────────────────────────────────────────────
const Sidebar = ({
  collapsed,
  handleCollapse,
  navigations,
  handleLogout,
  userData,
  company = null,
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
          companyLogo={company?.companyLogo}
          userData={userData}
          isMobile
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
        companyLogo={company?.companyLogo}
        userData={userData}
        onExpand={() => handleCollapse(false)}
      />
    </div>
  );
};

export default Sidebar;
