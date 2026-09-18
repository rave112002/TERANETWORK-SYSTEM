import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router";

import { loginApi, logoutApi } from "../../api/superadmin-console/auth";
import { useSuperAdminConsoleStore } from "../../../store/superAdminConsoleStore";

export const useSuperAdminLogin = () => {
  const setSession = useSuperAdminConsoleStore((s) => s.setSession);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: loginApi,
    onSuccess: (res) => {
      setSession(res?.data?.user ?? null);
      navigate("/superadmin/branches", { replace: true });
    },
  });
};

/**
 * Ends the server session, then forgets the login locally. The local reset
 * runs even if the server call fails: a person who pressed "Logout" must not
 * stay logged in on this screen.
 */
export const logoutSuperAdmin = async (queryClient) => {
  try {
    await logoutApi();
  } catch {
    // Session already gone, or server unreachable — log out locally anyway.
  }
  queryClient?.clear();
  useSuperAdminConsoleStore.getState().reset();
};

export const useSuperAdminLogout = () => {
  const queryClient = useQueryClient();
  return () => logoutSuperAdmin(queryClient);
};
