import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getOnusApi,
  getOnuByIdApi,
  createOnuApi,
  updateOnuApi,
  deleteOnuApi,
} from "../../../api/admin/network/onus";

// Query: list ONUs
export const useGetOnus = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["onus", filters],
    queryFn: () => getOnusApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
};

// Query: one ONU
export const useGetOnuById = (onuId) => {
  return useQuery({
    queryKey: ["onus", onuId],
    queryFn: () => getOnuByIdApi(onuId),
    enabled: !!onuId,
    staleTime: 10 * 60 * 1000,
  });
};

export const useCreateOnu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOnuApi,
    onSuccess: () => {
      toast.success("ONU created successfully");
      queryClient.invalidateQueries({ queryKey: ["onus"] });
      // The topology tree renders the whole chain, so any change to it is stale.
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create ONU");
    },
  });
};

export const useUpdateOnu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ onuId, data }) => updateOnuApi(onuId, data),
    onSuccess: (_res, variables) => {
      toast.success("ONU updated successfully");
      queryClient.invalidateQueries({ queryKey: ["onus"] });
      queryClient.invalidateQueries({ queryKey: ["onus", variables.onuId] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update ONU");
    },
  });
};

export const useDeleteOnu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOnuApi,
    onSuccess: () => {
      toast.success("ONU deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["onus"] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      // The API refuses to delete anything that still has children — surface
      // that reason rather than a generic failure.
      toast.error(error.response?.data?.message || "Failed to delete ONU");
    },
  });
};
