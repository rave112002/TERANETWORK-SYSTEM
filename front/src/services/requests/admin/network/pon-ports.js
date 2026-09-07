import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getPonPortsApi,
  getPonPortByIdApi,
  createPonPortApi,
  updatePonPortApi,
  deletePonPortApi,
} from "../../../api/admin/network/pon-ports";

// Query: list PON ports
export const useGetPonPorts = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["ponPorts", filters],
    queryFn: () => getPonPortsApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
};

// Query: one PON port
export const useGetPonPortById = (ponPortId) => {
  return useQuery({
    queryKey: ["ponPorts", ponPortId],
    queryFn: () => getPonPortByIdApi(ponPortId),
    enabled: !!ponPortId,
    staleTime: 10 * 60 * 1000,
  });
};

export const useCreatePonPort = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createPonPortApi,
    onSuccess: () => {
      toast.success("PON port created successfully");
      queryClient.invalidateQueries({ queryKey: ["ponPorts"] });
      // The topology tree renders the whole chain, so any change to it is stale.
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create PON port");
    },
  });
};

export const useUpdatePonPort = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ ponPortId, data }) => updatePonPortApi(ponPortId, data),
    onSuccess: (_res, variables) => {
      toast.success("PON port updated successfully");
      queryClient.invalidateQueries({ queryKey: ["ponPorts"] });
      queryClient.invalidateQueries({ queryKey: ["ponPorts", variables.ponPortId] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update PON port");
    },
  });
};

export const useDeletePonPort = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deletePonPortApi,
    onSuccess: () => {
      toast.success("PON port deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["ponPorts"] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      // The API refuses to delete anything that still has children — surface
      // that reason rather than a generic failure.
      toast.error(error.response?.data?.message || "Failed to delete PON port");
    },
  });
};
