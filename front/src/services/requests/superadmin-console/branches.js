import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createBranchApi,
  deleteBranchApi,
  getBranchHealthApi,
  getBranchesApi,
  updateBranchApi,
} from "../../api/superadmin-console/branches";

/** How often each branch is checked while the page is open. */
export const BRANCH_HEALTH_INTERVAL_MS = 30 * 1000;

export const useGetBranches = (options = {}) =>
  useQuery({
    queryKey: ["sa-branches"],
    queryFn: getBranchesApi,
    staleTime: 60 * 1000,
    ...options,
  });

/**
 * One health query per branch, so a slow or offline branch never holds up the
 * others (D10). Each refreshes on its own every 30 seconds.
 *
 * @param {string[]} branchIds
 */
export const useBranchHealthChecks = (branchIds) =>
  useQueries({
    queries: branchIds.map((branchId) => ({
      queryKey: ["sa-branches", branchId, "health"],
      queryFn: () => getBranchHealthApi(branchId),
      refetchInterval: BRANCH_HEALTH_INTERVAL_MS,
      staleTime: 10 * 1000,
      retry: false,
    })),
  });

const invalidateBranches = (queryClient) =>
  queryClient.invalidateQueries({ queryKey: ["sa-branches"] });

export const useCreateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBranchApi,
    onSuccess: () => {
      toast.success("Branch added");
      invalidateBranches(queryClient);
    },
    // Errors are shown next to the field in the drawer.
  });
};

export const useUpdateBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBranchApi,
    onSuccess: () => {
      toast.success("Branch updated");
      invalidateBranches(queryClient);
    },
  });
};

export const useDeleteBranch = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteBranchApi,
    onSuccess: () => {
      toast.success("Branch removed from SuperAdmin");
      invalidateBranches(queryClient);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not remove the branch");
    },
  });
};
