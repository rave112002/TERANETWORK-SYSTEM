import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Subscriptions — the customer + plan + ONU binding.
 *
 * `status` is not part of the create/update payloads. It moves through
 * `transitionSubscriptionApi`, and only the staff-owned edges are accepted:
 * suspension and restoration belong to the provisioning worker.
 */
export const getSubscriptionsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/subscriptions", { params: filters });
  return response.data;
};

export const getSubscriptionByIdApi = async (subscriptionId) => {
  const response = await api.get(`/api/v1/admin/subscriptions/${subscriptionId}`);
  return response.data;
};

export const createSubscriptionApi = async (data) => {
  const response = await api.post("/api/v1/admin/subscriptions", data);
  return response.data;
};

export const updateSubscriptionApi = async (subscriptionId, data) => {
  const response = await api.put(`/api/v1/admin/subscriptions/${subscriptionId}`, data);
  return response.data;
};

/**
 * @param {{
 *   action: 'activate'|'terminate'|'revoke'|'unrevoke'|'close',
 *   reason?: string,
 *   outcome?: 'recovered'|'not_recovered'
 * }} body `outcome` is required on 'close' — it decides whether the modem goes
 *   back into stock or is written off.
 */
export const transitionSubscriptionApi = async (subscriptionId, body) => {
  const response = await api.post(
    `/api/v1/admin/subscriptions/${subscriptionId}/status`,
    body,
  );
  return response.data;
};

export const deleteSubscriptionApi = async (subscriptionId) => {
  const response = await api.delete(`/api/v1/admin/subscriptions/${subscriptionId}`);
  return response.data;
};

/**
 * Accounts suspended long enough that somebody should decide whether to send a
 * technician for the modem. A list for a person; nothing here revokes anything.
 */
export const getRecoveryCandidatesApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/subscriptions/recovery/candidates", {
    params: filters,
  });
  return response.data;
};

/** Modems already marked for pull-out and still uncollected. */
export const getPendingPullOutsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/subscriptions/recovery/pending", {
    params: filters,
  });
  return response.data;
};
