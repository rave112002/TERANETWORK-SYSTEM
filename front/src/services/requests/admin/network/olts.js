import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getOltsApi,
  getOltByIdApi,
  createOltApi,
  updateOltApi,
  deleteOltApi,
} from "../../../api/admin/network/olts";

// Query: list OLTs
export const useGetOlts = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["olts", filters],
    queryFn: () => getOltsApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
};

// Query: one OLT
export const useGetOltById = (oltId) => {
  return useQuery({
    queryKey: ["olts", oltId],
    queryFn: () => getOltByIdApi(oltId),
    enabled: !!oltId,
    staleTime: 10 * 60 * 1000,
  });
};

export const useCreateOlt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createOltApi,
    onSuccess: () => {
      toast.success("OLT created successfully");
      queryClient.invalidateQueries({ queryKey: ["olts"] });
      // The topology tree renders the whole chain, so any change to it is stale.
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create OLT");
    },
  });
};

export const useUpdateOlt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ oltId, data }) => updateOltApi(oltId, data),
    onSuccess: (_res, variables) => {
      toast.success("OLT updated successfully");
      queryClient.invalidateQueries({ queryKey: ["olts"] });
      queryClient.invalidateQueries({ queryKey: ["olts", variables.oltId] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update OLT");
    },
  });
};

export const useDeleteOlt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteOltApi,
    onSuccess: () => {
      toast.success("OLT deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["olts"] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      // The API refuses to delete anything that still has children — surface
      // that reason rather than a generic failure.
      toast.error(error.response?.data?.message || "Failed to delete OLT");
    },
  });
};
