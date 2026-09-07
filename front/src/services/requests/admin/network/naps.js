import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getNapsApi,
  getNapByIdApi,
  createNapApi,
  updateNapApi,
  deleteNapApi,
} from "../../../api/admin/network/naps";

// Query: list NAPs
export const useGetNaps = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["naps", filters],
    queryFn: () => getNapsApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
};

// Query: one NAP
export const useGetNapById = (napId) => {
  return useQuery({
    queryKey: ["naps", napId],
    queryFn: () => getNapByIdApi(napId),
    enabled: !!napId,
    staleTime: 10 * 60 * 1000,
  });
};

export const useCreateNap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createNapApi,
    onSuccess: () => {
      toast.success("NAP created successfully");
      queryClient.invalidateQueries({ queryKey: ["naps"] });
      // The topology tree renders the whole chain, so any change to it is stale.
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create NAP");
    },
  });
};

export const useUpdateNap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ napId, data }) => updateNapApi(napId, data),
    onSuccess: (_res, variables) => {
      toast.success("NAP updated successfully");
      queryClient.invalidateQueries({ queryKey: ["naps"] });
      queryClient.invalidateQueries({ queryKey: ["naps", variables.napId] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update NAP");
    },
  });
};

export const useDeleteNap = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteNapApi,
    onSuccess: () => {
      toast.success("NAP deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["naps"] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      // The API refuses to delete anything that still has children — surface
      // that reason rather than a generic failure.
      toast.error(error.response?.data?.message || "Failed to delete NAP");
    },
  });
};
