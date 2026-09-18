import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  getBranchSystemSettingsApi,
  updateBranchSystemSettingsApi,
} from "../../api/superadmin-console/system";

const systemKey = (branchId) => ["sa-branches", branchId, "system-settings"];

export const useGetBranchSystemSettings = (branchId, options = {}) =>
  useQuery({
    queryKey: systemKey(branchId),
    queryFn: () => getBranchSystemSettingsApi(branchId),
    enabled: !!branchId,
    staleTime: 30 * 1000,
    retry: false,
    ...options,
  });

/**
 * The save returns the branch's settings as stored, so the cache is set from
 * it. Branch health is refreshed too: dry-run shows there as a warning.
 */
export const useUpdateBranchSystemSettings = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: updateBranchSystemSettingsApi,
    onSuccess: (res, { branchId }) => {
      toast.success(res?.message || "Settings saved");
      queryClient.setQueryData(systemKey(branchId), res);
      queryClient.invalidateQueries({ queryKey: ["sa-branches", branchId, "health"] });
    },
    onError: (error) => {
      // The schedule check names the two values that disagree; show it whole.
      toast.error(error.response?.data?.message || "The branch could not save the settings", {
        duration: 10000,
      });
    },
  });
};
