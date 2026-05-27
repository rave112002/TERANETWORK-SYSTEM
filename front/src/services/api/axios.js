import { message } from "antd";
import axios from "axios";
import {
  useAdminAuthStore,
  useSuperAdminAuthStore,
} from "../../store/authStore";
import { useCsrfStore } from "../../store/csrfStore";

export const axiosInstance = axios.create({
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

export const userTypeAuth = {
  admin: "admin",
  superadmin: "superadmin",
};

export const tokens = {
  [userTypeAuth.admin]: useAdminAuthStore,
  [userTypeAuth.superadmin]: useSuperAdminAuthStore,
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

    // Add Idempotency-Key header for POST, PATCH, PUT, DELETE requests
    if (shouldApplyIdempotencyKey(config)) {
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
        // Fetch new CSRF token
        const response = await axiosInstance.get("/api/v1/auth/csrf-token");
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

      // Add Idempotency-Key header
      if (shouldApplyIdempotencyKey(config)) {
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
          // Fetch new CSRF token using the appropriate user type endpoint
          const csrfEndpoint = user
            ? `/api/v1/${user}/auth/csrf-token`
            : "/api/v1/auth/csrf-token";
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

      // Handle authentication errors
      const authErrorMessages = [
        "Invalid or expired token.",
        "Invalid token.",
        "No token provided",
        "Token expired",
      ];

      if (
        authErrorMessages.includes(errMessage?.message) ||
        errMessage?.code === 300
      ) {
        message.warning(
          "Unable to process transaction. You have to login again.",
        );
      }

      return Promise.reject(error);
    },
  );

  // Cache the instance for reuse
  instanceCache.set(cacheKey, instance);

  return instance;
};

export default axiosInstance;
