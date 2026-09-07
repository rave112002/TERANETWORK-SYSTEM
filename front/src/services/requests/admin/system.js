import { toast } from "sonner";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import {
  getSystemSettingsApi,
  updateSystemSettingsApi,
  getJobsApi,
} from "../../api/admin/system";

export const useGetSystemSettings = () => {
  return useQuery({
    queryKey: ["systemSettings"],
    queryFn: getSystemSettingsApi,
    staleTime: 60 * 1000,
  });
};

export const useUpdateSystemSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSystemSettingsApi,
    onSuccess: (_res, variables) => {
      // Dry-run gets its own message: it is the one setting whose effect is
      // immediate and safety-relevant, so the toast states what now happens.
      if ("DRY_RUN" in variables) {
        toast.success(
          variables.DRY_RUN
            ? "Dry-run ON — device commands will be logged, not executed"
            : "Dry-run OFF — device commands will execute for real",
        );
      } else {
        toast.success("Settings saved");
      }
      queryClient.invalidateQueries({ queryKey: ["systemSettings"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to save settings");
    },
  });
};

export const useGetJobs = (filters = {}, options = {}) => {
  return useQuery({
    queryKey: ["jobs", filters],
    queryFn: () => getJobsApi(filters),
    placeholderData: keepPreviousData,
    // The queue is live state — a stale view of what the worker is doing is
    // worse than no view. Polls while the page is open.
    refetchInterval: 10 * 1000,
    staleTime: 0,
    ...options,
  });
};
