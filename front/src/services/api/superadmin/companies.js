import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);
const apiMultipart = createAxiosInstanceWithInterceptor(
  "multipart",
  userTypeAuth.superadmin,
);

export const getCompaniesApi = async (filters = {}) => {
  const response = await api.get("/api/v1/superadmin/companies", {
    params: filters,
  });
  return response.data;
};

export const getCompanyByIdApi = async (companyId) => {
  const response = await api.get(
    `/api/v1/superadmin/companies/${companyId}`,
  );
  return response.data;
};

export const createCompanyApi = async (companyData) => {
  const isFormData = companyData instanceof FormData;
  const instance = isFormData ? apiMultipart : api;
  const response = await instance.post(
    "/api/v1/superadmin/companies",
    companyData,
  );
  return response.data;
};

export const updateCompanyApi = async (
  companyId,
  companyData,
) => {
  const isFormData = companyData instanceof FormData;
  const instance = isFormData ? apiMultipart : api;
  const response = await instance.put(
    `/api/v1/superadmin/companies/${companyId}`,
    companyData,
  );
  return response.data;
};

export const deleteCompanyApi = async (companyId) => {
  const response = await api.delete(
    `/api/v1/superadmin/companies/${companyId}`,
  );
  return response.data;
};
