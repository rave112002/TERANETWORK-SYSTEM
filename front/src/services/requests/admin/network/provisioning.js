import { toast } from "sonner";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  provisionOnuApi,
  getActionLogsApi,
} from "../../../api/admin/network/provisioning";

const ACTION_LABEL = {
  activate: "Restore",
  deactivate: "Suspend",
  status: "Status check",
};

export const useProvisionOnu = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ onuId, action, reason }) => provisionOnuApi(onuId, action, { reason }),
    onSuccess: (response, variables) => {
      const label = ACTION_LABEL[variables.action] ?? variables.action;
      const { deduped, dryRun } = response?.data ?? {};

      // Deliberately never says "suspended" or "restored". Nothing has reached
      // the device yet — claiming otherwise is the exact lie this system is
      // built to avoid.
      if (deduped) {
        toast.info(`${label} is already queued for this modem`);
      } else if (dryRun) {
        toast.warning(`${label} queued — dry-run is ON, so nothing will be sent to the device`);
      } else {
        toast.success(`${label} queued — the worker will run it shortly`);
      }

      queryClient.invalidateQueries({ queryKey: ["onus"] });
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
      queryClient.invalidateQueries({ queryKey: ["actionLogs", variables.onuId] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not queue that action");
    },
  });
};

export const useGetActionLogs = (onuId, filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["actionLogs", onuId, filters],
    queryFn: () => getActionLogsApi(onuId, filters),
    enabled: !!onuId,
    placeholderData: keepPreviousData,
    // The worker runs these seconds after they are queued, so a static view
    // would show "nothing yet" exactly when someone is watching for the result.
    refetchInterval: 5000,
    staleTime: 0,
    ...options,
  });
};
