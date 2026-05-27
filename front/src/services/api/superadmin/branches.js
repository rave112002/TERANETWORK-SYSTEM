import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.superadmin);

export const getBranchesApi = async (filters = {}) => {
  const response = await api.get("/api/v1/superadmin/branches", {
    params: filters,
  });
  return response.data;
};

export const getBranchByIdApi = async (branchId) => {
  const response = await api.get(`/api/v1/superadmin/branches/${branchId}`);
  return response.data;
};

export const createBranchApi = async (branchData) => {
  const response = await api.post("/api/v1/superadmin/branches", branchData);
  return response.data;
};

export const updateBranchApi = async (branchId, branchData) => {
  const response = await api.put(
    `/api/v1/superadmin/branches/${branchId}`,
    branchData,
  );
  return response.data;
};

export const deleteBranchApi = async (branchId) => {
  const response = await api.delete(`/api/v1/superadmin/branches/${branchId}`);
  return response.data;
};
