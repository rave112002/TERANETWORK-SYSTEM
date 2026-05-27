import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);
const apiMultipart = createAxiosInstanceWithInterceptor(
  "multipart",
  userTypeAuth.superadmin,
);

export const getOrganizationsApi = async (filters = {}) => {
  const response = await api.get("/api/v1/superadmin/organizations", {
    params: filters,
  });
  return response.data;
};

export const getOrganizationByIdApi = async (organizationId) => {
  const response = await api.get(
    `/api/v1/superadmin/organizations/${organizationId}`,
  );
  return response.data;
};

export const createOrganizationApi = async (organizationData) => {
  const isFormData = organizationData instanceof FormData;
  const instance = isFormData ? apiMultipart : api;
  const response = await instance.post(
    "/api/v1/superadmin/organizations",
    organizationData,
  );
  return response.data;
};

export const updateOrganizationApi = async (
  organizationId,
  organizationData,
) => {
  const isFormData = organizationData instanceof FormData;
  const instance = isFormData ? apiMultipart : api;
  const response = await instance.put(
    `/api/v1/superadmin/organizations/${organizationId}`,
    organizationData,
  );
  return response.data;
};

export const deleteOrganizationApi = async (organizationId) => {
  const response = await api.delete(
    `/api/v1/superadmin/organizations/${organizationId}`,
  );
  return response.data;
};
