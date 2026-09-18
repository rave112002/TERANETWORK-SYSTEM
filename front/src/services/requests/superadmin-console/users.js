import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  createBranchUserApi,
  getBranchUsersApi,
  resetBranchUserPasswordApi,
  setBranchUserStatusApi,
} from "../../api/superadmin-console/users";

const usersKey = (branchId) => ["sa-branches", branchId, "users"];

export const useGetBranchUsers = (branchId, options = {}) =>
  useQuery({
    queryKey: usersKey(branchId),
    queryFn: () => getBranchUsersApi(branchId),
    enabled: !!branchId,
    staleTime: 30 * 1000,
    retry: false,
    ...options,
  });

const useUsersMutation = (mutationFn, { toastErrors = true } = {}) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (res, variables) => {
      toast.success(res?.message || "Done");
      queryClient.invalidateQueries({ queryKey: usersKey(variables.branchId) });
    },
    onError: toastErrors
      ? (error) => toast.error(error.response?.data?.message || "The branch could not do that")
      : undefined,
  });
};

/** Errors are shown in the drawer, next to the field that caused them. */
export const useCreateBranchUser = () => useUsersMutation(createBranchUserApi, { toastErrors: false });
export const useResetBranchUserPassword = () =>
  useUsersMutation(resetBranchUserPasswordApi, { toastErrors: false });
export const useSetBranchUserStatus = () => useUsersMutation(setBranchUserStatusApi);
