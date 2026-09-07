import { createAxiosInstanceWithInterceptor, userTypeAuth } from "../axios";

const api = createAxiosInstanceWithInterceptor("data", userTypeAuth.admin);

/**
 * Service plans — the speed/price catalogue. Company-wide, not branch-scoped.
 */
export const getPlansApi = async (filters = {}) => {
  const response = await api.get("/api/v1/admin/plans", { params: filters });
  return response.data;
};

export const getPlanByIdApi = async (planId) => {
  const response = await api.get(`/api/v1/admin/plans/${planId}`);
  return response.data;
};

export const createPlanApi = async (planData) => {
  const response = await api.post("/api/v1/admin/plans", planData);
  return response.data;
};

export const updatePlanApi = async (planId, planData) => {
  const response = await api.put(`/api/v1/admin/plans/${planId}`, planData);
  return response.data;
};

export const deletePlanApi = async (planId) => {
  const response = await api.delete(`/api/v1/admin/plans/${planId}`);
  return response.data;
};
