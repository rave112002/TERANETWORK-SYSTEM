import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAdminAuthStore } from "../../../store/authStore";
import { useCsrfStore } from "../../../store/csrfStore";
import {
  loginAdminApi,
  logoutAdminApi,
  getCsrfTokenApi,
} from "../../api/admin/auth";

export const useLoginAdminAuth = () => {
  const { setToken, setRefreshToken, setUserData, setPermissions } =
    useAdminAuthStore.getState();
  const { setCsrfToken } = useCsrfStore.getState();

  return useMutation({
    mutationFn: loginAdminApi,
    onSuccess: (response) => {
      const { user, token, refreshToken, permissions } = response.data;
      setToken(token);
      setRefreshToken(refreshToken?.token || null);
      setUserData(user);
      setPermissions(permissions || []);

      // Fetch CSRF token after successful login
      getCsrfTokenApi()
        .then((res) => {
          setCsrfToken(res.data?.csrfToken || res.csrfToken);
        })
        .catch((error) => {
          console.error("Failed to fetch CSRF token:", error);
        });

      toast.success("Login successful");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Login failed");
    },
  });
};

export const useLogoutAdminAuth = () => {
  const { reset } = useAdminAuthStore.getState();
  const { clearCsrfToken } = useCsrfStore.getState();

  return useMutation({
    mutationFn: logoutAdminApi,
    onSuccess: () => {
      reset();
      clearCsrfToken();
      toast.success("Logged out successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Logout failed");
    },
  });
};

export const useFetchCsrfToken = () => {
  const { setCsrfToken } = useCsrfStore.getState();

  return useMutation({
    mutationFn: getCsrfTokenApi,
    onSuccess: (data) => {
      setCsrfToken(data.csrfToken);
    },
    onError: (error) => {
      console.error("Failed to fetch CSRF token:", error);
    },
  });
};
