import axios from "axios";

import { useSuperAdminConsoleStore } from "../../../store/superAdminConsoleStore";

/**
 * The axios instance for superadmin-server, the central SuperAdmin app's own
 * server (not a branch API).
 *
 * - Same origin: in production superadmin-server serves this app; in dev Vite
 *   proxies `/api` to it. So no base host, and the session cookie just works.
 * - `X-Requested-With: superadmin` on every call: the server refuses changes
 *   without it, which is what stops another site from posting to it.
 * - A 401 means the session ended: forget the login so the guard sends the
 *   person back to the login page.
 */
const client = axios.create({
  baseURL: "/api",
  withCredentials: true,
  headers: { "X-Requested-With": "superadmin" },
  timeout: 20000,
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const isLoginCall = error.config?.url?.startsWith("/auth/login");
    if (error.response?.status === 401 && !isLoginCall) {
      useSuperAdminConsoleStore.getState().reset();
    }
    return Promise.reject(error);
  },
);

export default client;
