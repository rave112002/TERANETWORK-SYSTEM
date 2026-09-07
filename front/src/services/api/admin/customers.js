import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Subscribers. Scoped server-side to the branches the signed-in user is
 * assigned to — the `branchId` filter narrows within that, it cannot widen it.
 */
export const getCustomersApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/customers", { params: filters });
  return response.data;
};

export const getCustomerByIdApi = async (customerId) => {
  const response = await api.get(`/api/v1/admin/customers/${customerId}`);
  return response.data;
};

export const createCustomerApi = async (customerData) => {
  const response = await api.post("/api/v1/admin/customers", customerData);
  return response.data;
};

export const updateCustomerApi = async (customerId, customerData) => {
  const response = await api.put(
    `/api/v1/admin/customers/${customerId}`,
    customerData,
  );
  return response.data;
};

export const deleteCustomerApi = async (customerId) => {
  const response = await api.delete(`/api/v1/admin/customers/${customerId}`);
  return response.data;
};
