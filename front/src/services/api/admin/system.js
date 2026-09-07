import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Runtime settings and the background job queue.
 *
 * These live together because they share an audience: whoever may flip the
 * dry-run kill switch is exactly who needs to see what the worker is doing.
 */
export const getSystemSettingsApi = async () => {
  const response = await api.get("/api/v1/admin/system/settings");
  return response.data;
};

/** Send only the settings that are changing. */
export const updateSystemSettingsApi = async (settings) => {
  const response = await api.put("/api/v1/admin/system/settings", settings);
  return response.data;
};

export const getJobsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/system/jobs", { params: filters });
  return response.data;
};
