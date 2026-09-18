import axios from "axios";
import { toast } from "sonner";
import { useAdminAuthStore } from "../../store/authStore";
import { useCsrfStore } from "../../store/csrfStore";

export const axiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Only the Admin portal talks to the branch API. The central SuperAdmin app has
// its own client (services/api/superadmin-console/client.js) and server (D10).
export const userTypeAuth = {
  admin: "admin",
};

export const tokens = {
  [userTypeAuth.admin]: useAdminAuthStore,
};

export const getUserToken = (userType = userTypeAuth.admin) => {
  return tokens[userType]?.getState();
};

// Methods that require CSRF protection
const CSRF_PROTECTED_METHODS = ["post", "patch", "put", "delete"];

// Methods that require Idempotency-Key header
const IDEMPOTENCY_PROTECTED_METHODS = ["post", "patch", "put", "delete"];

const shouldApplyCsrfToken = (config) => {
  const method = config.method?.toLowerCase();
  const isCsrfEndpoint = config.url?.includes("/csrf-token");
  return !isCsrfEndpoint && CSRF_PROTECTED_METHODS.includes(method);
};

const shouldApplyIdempotencyKey = (config) => {
  const method = config.method?.toLowerCase();
  const isCsrfEndpoint = config.url?.includes("/csrf-token");
  return !isCsrfEndpoint && IDEMPOTENCY_PROTECTED_METHODS.includes(method);
};

// Generate a unique idempotency key
const generateIdempotencyKey = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Add CSRF token interceptor to axiosInstance
axiosInstance.interceptors.request.use(
  (config) => {
    const csrfToken = useCsrfStore?.getState()?.csrfToken;

    if (shouldApplyCsrfToken(config)) {
      if (csrfToken) {
        config.headers["x-csrf-token"] = csrfToken;
      } else {
        console.warn("No CSRF token available!");
      }
    }

    // Add Idempotency-Key header for POST, PATCH, PUT, DELETE requests.
    // Never overwrite an existing key: interceptor retries (CSRF refetch)
    // re-enter here, and the retry must present the SAME key so the backend
    // treats it as the same logical request.
    if (shouldApplyIdempotencyKey(config) && !config.headers["Idempotency-Key"]) {
      config.headers["Idempotency-Key"] = generateIdempotencyKey();
    }

    return config;
  },
  (error) => Promise.reject(error),
);

// Add response interceptor for CSRF token refetch
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check for CSRF validation failure
    if (
      error.response?.status === 403 &&
      error.response?.data?.code === "CSRF_VALIDATION_FAILED" &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        // Fetch a new CSRF token from the portal the failing request targeted
        // (e.g. /api/v1/admin/... → /api/v1/admin/auth/csrf-token). The token
        // itself is portal-agnostic, but there is no portal-less
        // /api/v1/auth/csrf-token route — it 404s "API not found" and breaks the
        // retry — so always resolve a real portal, defaulting to admin.
        const portal =
          originalRequest.url?.match(/\/api\/v1\/(admin|superadmin)\//)?.[1] ||
          "admin";
        const response = await axiosInstance.get(
          `/api/v1/${portal}/auth/csrf-token`,
        );
        const newCsrfToken = response.data.csrfToken;

        // Update the store with the new token
        useCsrfStore?.getState()?.setCsrfToken(newCsrfToken);

        // Update the original request with the new token if applicable
        if (shouldApplyCsrfToken(originalRequest)) {
          originalRequest.headers["x-csrf-token"] = newCsrfToken;
        }

        // Retry the original request
        return axiosInstance(originalRequest);
      } catch (refetchError) {
        console.error("Failed to refetch CSRF token:", refetchError);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

// ─── Token refresh (rotation-aware) ──────────────────────────────────
// One in-flight refresh per portal; concurrent 401s await the same promise
// instead of each firing their own /refresh (which would invalidate each
// other under rotation).
const refreshPromises = {
  [userTypeAuth.admin]: null,
};

const performTokenRefresh = async (user) => {
  const store = tokens[user];
  const refreshToken = store?.getState()?.refreshToken;
  if (!refreshToken) {
    throw new Error("No refresh token available");
  }

  // Use axiosInstance: it attaches the CSRF token and retries on CSRF failure
  const response = await axiosInstance.post(`/api/v1/${user}/auth/refresh`, {
    refreshToken,
  });

  const data = response.data?.data;
  const newAccessToken = data?.token || data?.accessToken?.token;
  const newRefreshToken = data?.refreshToken?.token;
  if (!newAccessToken) {
    throw new Error("Refresh response did not include a token");
  }

  store.getState().setToken(newAccessToken);
  if (newRefreshToken) {
    store.getState().setRefreshToken(newRefreshToken);
  }

  return newAccessToken;
};

const getRefreshedToken = (user) => {
  if (!refreshPromises[user]) {
    refreshPromises[user] = performTokenRefresh(user).finally(() => {
      refreshPromises[user] = null;
    });
  }
  return refreshPromises[user];
};

// Reset the portal's auth store — the <Auth> route guard reacts to the token
// clearing and redirects to that portal's login.
const handleSessionExpired = (user) => {
  const store = tokens[user];
  if (!store) return;
  const hadToken = !!store.getState().token;
  store.getState().reset();
  useCsrfStore?.getState()?.clearCsrfToken?.();
  if (hadToken) {
    toast.warning("Your session has expired. Please log in again.");
  }
};

// Cache for authenticated axios instances
const instanceCache = new Map();

export const createAxiosInstanceWithInterceptor = (
  type = "data",
  user = null,
) => {
  // Return cached instance if available - include user type in cache key
  const cacheKey = `${type}-${user || "default"}`;
  if (instanceCache.has(cacheKey)) {
    return instanceCache.get(cacheKey);
  }

  const headers = {};
  if (type === "data") {
    headers["Content-Type"] = "application/json";
  } else if (type === "multipart") {
    headers["Content-Type"] = "multipart/form-data";
  }

  const instance = axios.create({
    headers,
    withCredentials: true,
  });

  // Request interceptor: Add auth token and CSRF token
  instance.interceptors.request.use(
    (config) => {
      // Get fresh token state for each request
      const userTokenState = getUserToken(user);
      if (userTokenState?.token) {
        config.headers.Authorization = `Bearer ${userTokenState.token}`;
      } else {
        console.warn("No authentication token found");
      }

      // Add CSRF token for POST, PATCH, PUT, DELETE requests
      if (shouldApplyCsrfToken(config)) {
        const csrfToken = useCsrfStore?.getState()?.csrfToken;
        if (csrfToken) {
          config.headers["x-csrf-token"] = csrfToken;
        }
      }

      // Add Idempotency-Key header. Never overwrite an existing key —
      // interceptor retries (CSRF refetch, post-refresh 401 retry) re-enter
      // here and must present the SAME key so the backend treats them as the
      // same logical request.
      if (
        shouldApplyIdempotencyKey(config) &&
        !config.headers["Idempotency-Key"]
      ) {
        config.headers["Idempotency-Key"] = generateIdempotencyKey();
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  // Response interceptor: Handle CSRF failures and auth errors
  instance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const errMessage = error.response?.data;
      const originalRequest = error.config;

      // Handle CSRF validation failure
      if (
        error.response?.status === 403 &&
        errMessage?.code === "CSRF_VALIDATION_FAILED" &&
        !originalRequest._retry
      ) {
        originalRequest._retry = true;

        try {
          // Fetch new CSRF token using the appropriate user type endpoint.
          // Default to the admin endpoint — the token is portal-agnostic and
          // there is no portal-less /api/v1/auth route.
          const csrfEndpoint = user
            ? `/api/v1/${user}/auth/csrf-token`
            : "/api/v1/admin/auth/csrf-token";
          const response = await axiosInstance.get(csrfEndpoint);
          const newCsrfToken = response.data.csrfToken;

          // Update the store with the new token
          useCsrfStore?.getState()?.setCsrfToken(newCsrfToken);

          // Update the original request with the new token if applicable
          if (shouldApplyCsrfToken(originalRequest)) {
            originalRequest.headers["x-csrf-token"] = newCsrfToken;
          }

          // Retry the original request
          return instance(originalRequest);
        } catch (refetchError) {
          console.error("Failed to refetch CSRF token:", refetchError);
          return Promise.reject(error);
        }
      }

      // Handle expired/invalid access tokens: try one refresh, then retry.
      // Concurrent 401s share the same in-flight refresh via getRefreshedToken.
      if (error.response?.status === 401 && user) {
        if (originalRequest._authRetry) {
          // The request already retried with a fresh token and still got 401
          handleSessionExpired(user);
          return Promise.reject(error);
        }
        originalRequest._authRetry = true;

        try {
          const newToken = await getRefreshedToken(user);
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return instance(originalRequest);
        } catch {
          // Refresh failed (missing/expired/revoked refresh token)
          handleSessionExpired(user);
          return Promise.reject(error);
        }
      }

      return Promise.reject(error);
    },
  );

  // Cache the instance for reuse
  instanceCache.set(cacheKey, instance);

  return instance;
};

export default axiosInstance;
