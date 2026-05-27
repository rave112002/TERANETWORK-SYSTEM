import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { Suspense, lazy } from "react";
import { ComponentLoader } from "../components/LoadingFallback";
import AdminRoute from "./pageRoutes/AdminRoute";
import SuperAdminRoute from "./pageRoutes/SuperAdminRoute";

const LandingPage = lazy(() => import("../pages/LandingPage"));

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
        <Route path="/admin/*" element={<AdminRoute />} />
        <Route path="/superadmin/*" element={<SuperAdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default RootRoutes;
