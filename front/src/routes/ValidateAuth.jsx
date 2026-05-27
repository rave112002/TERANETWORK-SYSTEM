import { Navigate, Outlet } from "react-router";

export const Auth = ({ store, redirect }) => {
  const token = store((state) => state.token);

  if (!token) {
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
};

export const UnAuth = ({ store, redirect }) => {
  const token = store((state) => state.token);

  if (token) {
    return <Navigate to={redirect} replace />;
  }

  return <Outlet />;
};
