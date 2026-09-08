import { Home, User } from "lucide-react";
import { FileText, Network, Receipt, Server, Settings, UsersRound } from "lucide-react";
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router";
import BasicLayout from "../../components/layout/BasicLayout";
import { ComponentLoader } from "../../components/LoadingFallback";
import NotFound from "../../components/NotFound";
import { useAdminAuthStore } from "../../store/authStore";
import { Auth, UnAuth } from "../ValidateAuth";
import { ProtectedRoute } from "../../components/ProtectedRoute";

const Login = lazy(() => import("../../pages/Admin/Login"));
const ForgotPassword = lazy(() => import("../../pages/Auth/ForgotPassword"));
const ResetPassword = lazy(() => import("../../pages/Auth/ResetPassword"));
const Dashboard = lazy(() => import("../../pages/Admin/Dashboard"));
const Users = lazy(() => import("../../pages/Admin/UserManagement/Users"));
const Roles = lazy(() => import("../../pages/Admin/UserManagement/Roles"));
const SettingsPage = lazy(() => import("../../pages/Admin/Settings"));
const AuditTrail = lazy(() => import("../../pages/Admin/AuditTrail"));
const AccountSettings = lazy(() => import("../../pages/Admin/AccountSettings"));
const Customers = lazy(() => import("../../pages/Admin/Customers"));
const Plans = lazy(() => import("../../pages/Admin/Plans"));
const Subscriptions = lazy(() => import("../../pages/Admin/Subscriptions"));
const Topology = lazy(() => import("../../pages/Admin/Network/Topology"));
const Olts = lazy(() => import("../../pages/Admin/Network/Olts"));
const PonPorts = lazy(() => import("../../pages/Admin/Network/PonPorts"));
const Splitters = lazy(() => import("../../pages/Admin/Network/Splitters"));
const Naps = lazy(() => import("../../pages/Admin/Network/Naps"));
const Onus = lazy(() => import("../../pages/Admin/Network/Onus"));
const Discovery = lazy(() => import("../../pages/Admin/Network/Discovery"));
const System = lazy(() => import("../../pages/Admin/System"));
const Invoices = lazy(() => import("../../pages/Admin/Billing/Invoices"));
const Payments = lazy(() => import("../../pages/Admin/Billing/Payments"));
const Adjustments = lazy(() => import("../../pages/Admin/Billing/Adjustments"));
const Dunning = lazy(() => import("../../pages/Admin/Billing/Dunning"));

const AdminRoute = () => {
  const navigations = [
    {
      route: "/dashboard",
      name: "Dashboard",
      label: "Dashboard",
      icon: <Home className="h-5 w-5" />,
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <ProtectedRoute module="dashboard" accessLevel="read">
            <Dashboard />
          </ProtectedRoute>
        </Suspense>
      ),
      permission: { module: "dashboard", submodule: null, accessLevel: "read" },
      isFilter: true,
      isShow: true,
    },
    {
      key: "user-management",
      name: "User Management",
      label: "User Management",
      icon: <User className="h-5 w-5" />,
      permission: {
        anyOf: [
          { module: "users", submodule: "list", accessLevel: "read" },
          { module: "users", submodule: "roles", accessLevel: "read" },
        ],
      },
      isFilter: true,
      isShow: true,
      children: [
        {
          route: "/users",
          name: "Users",
          label: "Users",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute
                module="users"
                submodule="list"
                accessLevel="read"
              >
                <Users />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "users",
            submodule: "list",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/roles",
          name: "Roles",
          label: "Roles",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute
                module="users"
                submodule="roles"
                accessLevel="read"
              >
                <Roles />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "users",
            submodule: "roles",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
      ],
    },
    {
      key: "subscribers",
      name: "Subscribers",
      label: "Subscribers",
      icon: <UsersRound className="h-5 w-5" />,
      permission: {
        anyOf: [
          { module: "customers", submodule: null, accessLevel: "read" },
          { module: "subscriptions", submodule: null, accessLevel: "read" },
          { module: "plans", submodule: null, accessLevel: "read" },
        ],
      },
      isFilter: true,
      isShow: true,
      children: [
        {
          route: "/customers",
          name: "Customers",
          label: "Customers",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="customers" accessLevel="read">
                <Customers />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "customers",
            submodule: null,
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/subscriptions",
          name: "Subscriptions",
          label: "Subscriptions",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="subscriptions" accessLevel="read">
                <Subscriptions />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "subscriptions",
            submodule: null,
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/plans",
          name: "Service Plans",
          label: "Service Plans",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="plans" accessLevel="read">
                <Plans />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "plans",
            submodule: null,
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
      ],
    },
    {
      key: "billing",
      name: "Billing",
      label: "Billing",
      icon: <Receipt className="h-5 w-5" />,
      permission: {
        anyOf: [
          { module: "billing", submodule: "invoices", accessLevel: "read" },
          { module: "billing", submodule: "payments", accessLevel: "read" },
          { module: "billing", submodule: "adjustments", accessLevel: "read" },
          { module: "billing", submodule: "dunning", accessLevel: "read" },
        ],
      },
      isFilter: true,
      isShow: true,
      children: [
        {
          route: "/invoices",
          name: "Invoices",
          label: "Invoices",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="billing" submodule="invoices" accessLevel="read">
                <Invoices />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "billing",
            submodule: "invoices",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/payments",
          name: "Payments",
          label: "Payments",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="billing" submodule="payments" accessLevel="read">
                <Payments />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "billing",
            submodule: "payments",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/adjustments",
          name: "Adjustments",
          label: "Adjustments",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="billing" submodule="adjustments" accessLevel="read">
                <Adjustments />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "billing",
            submodule: "adjustments",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/dunning",
          name: "Dunning",
          label: "Dunning",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="billing" submodule="dunning" accessLevel="read">
                <Dunning />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "billing",
            submodule: "dunning",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
      ],
    },
    {
      key: "network",
      name: "Network",
      label: "Network",
      icon: <Network className="h-5 w-5" />,
      permission: {
        anyOf: [
          { module: "network", submodule: "topology", accessLevel: "read" },
          { module: "network", submodule: "olts", accessLevel: "read" },
          { module: "network", submodule: "naps", accessLevel: "read" },
          { module: "network", submodule: "onus", accessLevel: "read" },
          { module: "network", submodule: "discovery", accessLevel: "read" },
        ],
      },
      isFilter: true,
      isShow: true,
      children: [
        {
          route: "/topology",
          name: "Topology",
          label: "Topology",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="network" submodule="topology" accessLevel="read">
                <Topology />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "network",
            submodule: "topology",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/olts",
          name: "OLTs",
          label: "OLTs",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="network" submodule="olts" accessLevel="read">
                <Olts />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "network",
            submodule: "olts",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/pon-ports",
          name: "PON Ports",
          label: "PON Ports",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="network" submodule="pon_ports" accessLevel="read">
                <PonPorts />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "network",
            submodule: "pon_ports",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/splitters",
          name: "Splitters",
          label: "Splitters",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="network" submodule="splitters" accessLevel="read">
                <Splitters />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "network",
            submodule: "splitters",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/naps",
          name: "NAPs",
          label: "NAPs",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="network" submodule="naps" accessLevel="read">
                <Naps />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "network",
            submodule: "naps",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/onus",
          name: "ONUs",
          label: "ONUs",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="network" submodule="onus" accessLevel="read">
                <Onus />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "network",
            submodule: "onus",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
        {
          route: "/discovery",
          name: "Discovery",
          label: "Discovery",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <ProtectedRoute module="network" submodule="discovery" accessLevel="read">
                <Discovery />
              </ProtectedRoute>
            </Suspense>
          ),
          permission: {
            module: "network",
            submodule: "discovery",
            accessLevel: "read",
          },
          isFilter: true,
          isShow: true,
        },
      ],
    },
    {
      route: "/settings",
      name: "Settings",
      label: "Settings",
      icon: <Settings className="h-5 w-5" />,
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <ProtectedRoute module="settings" accessLevel="read">
            <SettingsPage />
          </ProtectedRoute>
        </Suspense>
      ),
      permission: { module: "settings", submodule: null, accessLevel: "read" },
      isFilter: true,
      isShow: true,
      section: "system", // renders below the sidebar divider
    },
    {
      route: "/system",
      name: "System",
      label: "System",
      icon: <Server className="h-5 w-5" />,
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <ProtectedRoute module="system" accessLevel="read">
            <System />
          </ProtectedRoute>
        </Suspense>
      ),
      permission: { module: "system", submodule: null, accessLevel: "read" },
      isFilter: true,
      isShow: true,
      section: "system", // renders below the sidebar divider
    },
    {
      route: "/audit-trail",
      name: "Audit Trail",
      label: "Audit Trail",
      icon: <FileText className="h-5 w-5" />,
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <ProtectedRoute module="audit_trail" accessLevel="read">
            <AuditTrail />
          </ProtectedRoute>
        </Suspense>
      ),
      permission: {
        module: "audit_trail",
        submodule: null,
        accessLevel: "read",
      },
      isFilter: true,
      isShow: true,
      section: "system", // renders below the sidebar divider
    },
  ].map((page) => {
    if (page.children) {
      return {
        ...page,
        children: page.children.map((child) => ({
          ...child,
          route: `/admin/${page.key}` + child.route,
        })),
      };
    }
    return { ...page, route: "/admin" + page.route };
  });

  return (
    <Routes>
      <Route
        element={
          <UnAuth store={useAdminAuthStore} redirect="/admin/dashboard" />
        }
      >
        <Route
          path="/"
          index
          element={
            <Suspense fallback={<ComponentLoader />}>
              <Login />
            </Suspense>
          }
        />
        <Route
          path="forgot-password"
          element={
            <Suspense fallback={<ComponentLoader />}>
              <ForgotPassword portal="admin" />
            </Suspense>
          }
        />
        <Route
          path="reset-password"
          element={
            <Suspense fallback={<ComponentLoader />}>
              <ResetPassword portal="admin" />
            </Suspense>
          }
        />
      </Route>

      <Route element={<Auth store={useAdminAuthStore} redirect="/admin" />}>
        <Route
          element={
            <BasicLayout navigations={navigations} store={useAdminAuthStore} />
          }
        >
          {navigations
            .filter((page) => page.isShow)
            .flatMap((page) => {
              if (page.children) {
                return page.children
                  .filter((child) => child.isShow)
                  .map((child) => {
                    const routePath = child.route.replace("/admin/", "");
                    return (
                      <Route
                        key={child.route}
                        path={routePath}
                        element={child.component}
                      />
                    );
                  });
              }
              const routePath = page.route.replace("/admin/", "");
              return (
                <Route
                  key={page.route}
                  path={routePath}
                  element={page.component}
                />
              );
            })}

          <Route
            path="account-settings"
            element={
              <Suspense fallback={<ComponentLoader />}>
                <AccountSettings />
              </Suspense>
            }
          />

          <Route path="*" element={<NotFound homePath="/admin/dashboard" />} />
        </Route>
      </Route>
    </Routes>
  );
};

export default AdminRoute;
