import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Suspense, lazy } from "react";
import { ComponentLoader } from "../components/LoadingFallback";
import { useAdminAuthStore } from "../store/authStore";
import AdminRoute from "./pageRoutes/AdminRoute";
import { UnAuth } from "./ValidateAuth";

const Login = lazy(() => import("../pages/Admin/Login"));
const PayInvoice = lazy(() => import("../pages/Public/PayInvoice"));

// The template's component showcase — a development aid, not part of the
// product. `import.meta.env.DEV` is false in a build, so the page is not
// shipped to branches at all.
const DesignSystem = import.meta.env.DEV ? lazy(() => import("../pages/LandingPage")) : null;

const RootRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* The login is the front door: a branch PC's address opens straight
            onto it. Someone already signed in goes on to the dashboard. */}
        <Route element={<UnAuth store={useAdminAuthStore} redirect="/admin/dashboard" />}>
          <Route
            path="/"
            element={
              <Suspense fallback={<ComponentLoader />}>
                <Login />
              </Suspense>
            }
          />
        </Route>
        {DesignSystem && (
          <Route
            path="/design-system"
            element={
              <Suspense fallback={<ComponentLoader />}>
                <DesignSystem />
              </Suspense>
            }
          />
        )}
        {/* The customer-facing payment page. Deliberately outside both
            portals: it has no login, no sidebar and no auth store, and the
            token in the URL is the only credential. */}
        <Route
          path="/pay/:token"
          element={
            <Suspense fallback={<ComponentLoader />}>
              <PayInvoice />
            </Suspense>
          }
        />
        <Route path="/admin/*" element={<AdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default RootRoutes;
