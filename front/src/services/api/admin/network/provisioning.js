import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Manual provisioning.
 *
 * These endpoints ENQUEUE work and return 202 — they do not talk to a device.
 * The response means "queued", never "done", and the UI has to say so: a modem
 * is only actually suspended once the worker gets a confirmation back from the
 * OLT, which is seconds later at best.
 */
export const provisionOnuApi = async (onuId, action, body = {}) => {
  const response = await api.post(
    `/api/v1/admin/network/provisioning/onus/${onuId}/${action}`,
    body,
  );
  return response.data;
};

/** The device black box for one modem: every command sent and the reply. */
export const getActionLogsApi = async (onuId, filters = {}) => {
  const response = await api.get(
    `/api/v1/admin/network/provisioning/onus/${onuId}/action-logs`,
    { params: filters },
  );
  return response.data;
};
