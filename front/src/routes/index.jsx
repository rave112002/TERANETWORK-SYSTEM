import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Suspense, lazy } from "react";
import { ComponentLoader } from "../components/LoadingFallback";
import AdminRoute from "./pageRoutes/AdminRoute";
import SuperAdminRoute from "./pageRoutes/SuperAdminRoute";

const LandingPage = lazy(() => import("../pages/LandingPage"));
const PayInvoice = lazy(() => import("../pages/Public/PayInvoice"));

const RootRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <Suspense fallback={<ComponentLoader />}>
              <LandingPage />
            </Suspense>
          }
        />
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
        <Route path="/superadmin/*" element={<SuperAdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default RootRoutes;
