import { useMutation } from "@tanstack/react-query";
import { message, Modal } from "antd";
import { useSuperAdminAuthStore } from "../../../store/authStore";
import { useCsrfStore } from "../../../store/csrfStore";
import {
  loginSuperAdminApi,
  logoutSuperAdminApi,
  getCsrfTokenApi,
} from "../../api/superadmin/auth";

export const useLoginSuperAdminAuth = () => {
  const { setToken, setRefreshToken, setUserData } =
    useSuperAdminAuthStore.getState();
  const { setCsrfToken } = useCsrfStore.getState();

  return useMutation({
    mutationFn: loginSuperAdminApi,
    onSuccess: (response) => {
      const { user, token, refreshToken } = response.data;
      setToken(token);
      setRefreshToken(refreshToken?.token || null);
      setUserData(user);

      // Fetch CSRF token after successful login
      getCsrfTokenApi()
        .then((res) => {
          setCsrfToken(res.data?.csrfToken || res.csrfToken);
        })
        .catch((error) => {
          console.error("Failed to fetch CSRF token:", error);
        });

      message.success("Login successful");
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Login failed");
    },
    onSettled: () => {
      Modal.destroyAll();
    },
  });
};

export const useLogoutSuperAdminAuth = () => {
  const { reset } = useSuperAdminAuthStore.getState();
  const { clearCsrfToken } = useCsrfStore.getState();

  return useMutation({
    mutationFn: logoutSuperAdminApi,
    onSuccess: () => {
      reset();
      clearCsrfToken();
      message.success("Logged out successfully");
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Logout failed");
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
