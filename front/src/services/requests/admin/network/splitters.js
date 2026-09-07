import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getSplittersApi,
  getSplitterByIdApi,
  createSplitterApi,
  updateSplitterApi,
  deleteSplitterApi,
} from "../../../api/admin/network/splitters";

// Query: list splitters
export const useGetSplitters = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["splitters", filters],
    queryFn: () => getSplittersApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });
};

// Query: one splitter
export const useGetSplitterById = (splitterId) => {
  return useQuery({
    queryKey: ["splitters", splitterId],
    queryFn: () => getSplitterByIdApi(splitterId),
    enabled: !!splitterId,
    staleTime: 10 * 60 * 1000,
  });
};

export const useCreateSplitter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createSplitterApi,
    onSuccess: () => {
      toast.success("splitter created successfully");
      queryClient.invalidateQueries({ queryKey: ["splitters"] });
      // The topology tree renders the whole chain, so any change to it is stale.
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create splitter");
    },
  });
};

export const useUpdateSplitter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ splitterId, data }) => updateSplitterApi(splitterId, data),
    onSuccess: (_res, variables) => {
      toast.success("splitter updated successfully");
      queryClient.invalidateQueries({ queryKey: ["splitters"] });
      queryClient.invalidateQueries({ queryKey: ["splitters", variables.splitterId] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update splitter");
    },
  });
};

export const useDeleteSplitter = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteSplitterApi,
    onSuccess: () => {
      toast.success("splitter deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["splitters"] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      // The API refuses to delete anything that still has children — surface
      // that reason rather than a generic failure.
      toast.error(error.response?.data?.message || "Failed to delete splitter");
    },
  });
};
