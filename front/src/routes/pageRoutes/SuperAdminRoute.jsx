import { HomeOutlined } from "@ant-design/icons";
import { Building2, MapPin, Settings, Users } from "lucide-react";
import { Suspense, lazy } from "react";
import { Route, Routes } from "react-router";
import BasicLayout from "../../components/layout/BasicLayout";
import { ComponentLoader } from "../../components/LoadingFallback";
import { useSuperAdminAuthStore } from "../../store/authStore";
import { Auth, UnAuth } from "../ValidateAuth";

const Login = lazy(() => import("../../pages/SuperAdmin/Login"));
const Dashboard = lazy(() => import("../../pages/SuperAdmin/Dashboard"));
const Companies = lazy(
  () => import("../../pages/SuperAdmin/Companies"),
);
const Branches = lazy(
  () => import("../../pages/SuperAdmin/CompanyManagement/Branches"),
);
const SuperAdminUsers = lazy(() => import("../../pages/SuperAdmin/Users"));
const AccountSettings = lazy(() => import("../../pages/Admin/AccountSettings"));

const SuperAdminRoute = () => {
  // ========== Navigation Configuration ==========
  const navigations = [
    {
      route: "/dashboard",
      name: "Dashboard",
      label: "Dashboard",
      icon: <HomeOutlined className="h-5 w-5" />,
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <Dashboard />
        </Suspense>
      ),
      isFilter: true,
      isShow: true,
    },
    {
      key: "company-management",
      name: "Company Management",
      label: "Company Management",
      icon: <Building2 className="h-5 w-5" />,
      isFilter: true,
      isShow: true,
      children: [
        {
          route: "/companies",
          name: "Companies",
          label: "Companies",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <Companies />
            </Suspense>
          ),
          isFilter: true,
          isShow: true,
        },
        {
          route: "/branches",
          name: "Branches",
          label: "Branches",
          component: (
            <Suspense fallback={<ComponentLoader />}>
              <Branches />
            </Suspense>
          ),
          isFilter: true,
          isShow: true,
        },
      ],
    },
    {
      route: "/users",
      name: "Users",
      label: "User Management",
      icon: <Users className="h-5 w-5" />,
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <SuperAdminUsers />
        </Suspense>
      ),
      isFilter: true,
      isShow: true,
    },
    {
      route: "/settings",
      name: "Settings",
      label: "System Settings",
      icon: <Settings className="h-5 w-5" />,
      component: (
        <Suspense fallback={<ComponentLoader />}>
          <div className="p-8">
            <h1
              className="font-semibold"
              style={{ fontSize: 26, letterSpacing: "-0.5px" }}
            >
              System Settings
            </h1>
            <p
              className="mt-2"
              style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
            >
              Configure system settings
            </p>
          </div>
        </Suspense>
      ),
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
          route: `/superadmin/${page.key}` + child.route,
        })),
      };
    }
    return { ...page, route: "/superadmin" + page.route };
  });

  // ========== Render Routes ==========
  return (
    <Routes>
      <Route
        element={
          <UnAuth
            store={useSuperAdminAuthStore}
            redirect="/superadmin/dashboard"
          />
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
      </Route>

      {/* Protected Route Wrapper */}
      <Route
        element={<Auth store={useSuperAdminAuthStore} redirect="/superadmin" />}
      >
        {/* Main Layout Route */}
        <Route
          element={
            <BasicLayout
              navigations={navigations}
              store={useSuperAdminAuthStore}
            />
          }
        >
          {navigations
            .filter((page) => page.isShow)
            .flatMap((page) => {
              if (page.children) {
                return page.children
                  .filter((child) => child.isShow)
                  .map((child) => {
                    const routePath = child.route.replace("/superadmin/", "");
                    return (
                      <Route
                        key={child.route}
                        path={routePath}
                        element={child.component}
                      />
                    );
                  });
              }
              const routePath = page.route.replace("/superadmin/", "");
              return (
                <Route
                  key={page.route}
                  path={routePath}
                  element={page.component}
                />
              );
            })}

          {/* Fallback Route */}
          <Route
            path="account-settings"
            element={
              <Suspense fallback={<ComponentLoader />}>
                <AccountSettings />
              </Suspense>
            }
          />
          <Route path="*" element={<div>Page Not Found</div>} />
        </Route>
      </Route>
    </Routes>
  );
};

export default SuperAdminRoute;
