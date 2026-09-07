import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  getBranchesApi,
  getBranchByIdApi,
  createBranchApi,
  updateBranchApi,
  deleteBranchApi,
} from "../../api/superadmin/branches";

// `options` lets a caller gate the fetch (`{ enabled: false }`) — e.g. a drawer
// that should not query until it is open and knows which company to ask about.
export const useGetBranches = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["superadmin-branches", filters],
    queryFn: () => getBranchesApi(filters),
    staleTime: 5 * 60 * 1000,
    placeholderData: keepPreviousData, // keep old rows visible while paginating/filtering
    ...options,
  });
};

export const useGetBranchById = (branchId) => {
  return useQuery({
    queryKey: ["superadmin-branches", branchId],
    queryFn: () => getBranchByIdApi(branchId),
    enabled: !!branchId,
  });
};

export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBranchApi,
    onSuccess: () => {
      toast.success("Branch created successfully");
      queryClient.invalidateQueries({ queryKey: ["superadmin-branches"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create branch");
    },
  });
};

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ branchId, branchData }) =>
      updateBranchApi(branchId, branchData),
    onSuccess: () => {
      toast.success("Branch updated successfully");
      queryClient.invalidateQueries({ queryKey: ["superadmin-branches"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to update branch");
    },
  });
};

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBranchApi,
    onSuccess: () => {
      toast.success("Branch deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["superadmin-branches"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to delete branch");
    },
  });
};
