import { Suspense, lazy } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import { Building2, Server, Users } from "lucide-react";

import BasicLayout from "../components/layout/BasicLayout";
import { ComponentLoader } from "../components/LoadingFallback";
import { useSuperAdminLogout } from "../services/requests/superadmin-console/auth";
import { useSuperAdminConsoleStore } from "../store/superAdminConsoleStore";
import { Auth, UnAuth } from "./ValidateAuth";

/**
 * The route tree of the CENTRAL SuperAdmin app (docs/decisions.md D10).
 *
 * Only used by `npm run build:superadmin` / `dev:superadmin` (vite.config.js
 * points `@app-routes` here). The branch build uses routes/index.jsx and never
 * imports this file, so none of these pages ship to a branch PC.
 *
 * Paths stay under /superadmin so the shared layout pieces (sidebar, the
 * permission hook) recognise this as the SuperAdmin portal.
 */

// Checked by scripts/check-build.mjs: present in this build, absent from the branch build.
export const BUILD_MARKER = "teranetwork-superadmin-console";
if (typeof document !== "undefined") document.documentElement.dataset.app = BUILD_MARKER;

const Login = lazy(() => import("../pages/SuperAdminConsole/Login"));
const Branches = lazy(() => import("../pages/SuperAdminConsole/Branches"));
const CompanyProfile = lazy(() => import("../pages/SuperAdminConsole/CompanyProfile"));
const BranchUsers = lazy(() => import("../pages/SuperAdminConsole/Users"));

const page = (Component) => (
  <Suspense fallback={<ComponentLoader />}>
    <Component />
  </Suspense>
);

const navigations = [
  {
    route: "/superadmin/branches",
    name: "Branches",
    label: "Branches",
    icon: <Server className="h-5 w-5" />,
    component: page(Branches),
    isFilter: true,
    isShow: true,
  },
  // Per-branch pages: each has a branch picker and acts on one branch at a time.
  {
    route: "/superadmin/company-profile",
    name: "Company Profile",
    label: "Company Profile",
    icon: <Building2 className="h-5 w-5" />,
    component: page(CompanyProfile),
    isFilter: true,
    isShow: true,
  },
  {
    route: "/superadmin/users",
    name: "Users",
    label: "Users",
    icon: <Users className="h-5 w-5" />,
    component: page(BranchUsers),
    isFilter: true,
    isShow: true,
  },
];

/** BasicLayout reads `store()`; logging out here must also end the server session. */
const useLayoutStore = () => {
  const state = useSuperAdminConsoleStore();
  const logout = useSuperAdminLogout();
  return { ...state, reset: logout };
};

const SuperAdminRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route
        element={<UnAuth store={useSuperAdminConsoleStore} redirect="/superadmin/branches" />}
      >
        <Route path="/superadmin/login" element={page(Login)} />
      </Route>

      <Route element={<Auth store={useSuperAdminConsoleStore} redirect="/superadmin/login" />}>
        <Route element={<BasicLayout navigations={navigations} store={useLayoutStore} />}>
          {navigations.map((nav) => (
            <Route key={nav.route} path={nav.route} element={nav.component} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/superadmin/branches" replace />} />
    </Routes>
  </BrowserRouter>
);

export default SuperAdminRoutes;
