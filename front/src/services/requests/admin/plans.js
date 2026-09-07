import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getPlansApi,
  getPlanByIdApi,
  createPlanApi,
  updatePlanApi,
  deletePlanApi,
} from "../../api/admin/plans";

// Query: list plans
export const useGetPlans = (filters = {}) => {
  return useQuery({
    queryKey: ["plans", filters],
    queryFn: () => getPlansApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep rows visible while paginating
  });
};

// Query: single plan
export const useGetPlanById = (planId) => {
  return useQuery({
    queryKey: ["plans", planId],
    queryFn: () => getPlanByIdApi(planId),
    enabled: !!planId,
    staleTime: 10 * 60 * 1000,
  });
};

// Mutation: create
export const useCreatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPlanApi,
    onSuccess: () => {
      toast.success("Plan created successfully");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create plan");
    },
  });
};

// Mutation: update
export const useUpdatePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ planId, planData }) => updatePlanApi(planId, planData),
    onSuccess: (_data, variables) => {
      toast.success("Plan updated successfully");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      queryClient.invalidateQueries({ queryKey: ["plans", variables.planId] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update plan");
    },
  });
};

// Mutation: soft delete
export const useDeletePlan = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePlanApi,
    onSuccess: () => {
      toast.success("Plan deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["plans"] });
    },
    onError: (error) => {
      // The API refuses to delete a plan that still has subscriptions on it —
      // surface that reason rather than a generic failure.
      toast.error(error.response?.data?.message || "Failed to delete plan");
    },
  });
};
