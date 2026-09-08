import { toast } from "sonner";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getDiscoveredItemsApi,
  getDiscoveryRunApi,
  getDiscoveryRunsApi,
  importDiscoveredItemApi,
  runDiscoveryApi,
} from "../../../api/admin/network/discovery";

export const useGetDiscoveryRuns = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["discovery", "runs", filters],
    queryFn: () => getDiscoveryRunsApi(filters),
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

export const useGetDiscoveryRun = (discoveryRunId, options = {}) =>
  useQuery({
    queryKey: ["discovery", "runs", discoveryRunId],
    queryFn: () => getDiscoveryRunApi(discoveryRunId),
    enabled: !!discoveryRunId,
    staleTime: 5 * 60 * 1000,
    ...options,
  });

export const useGetDiscoveredItems = (discoveryRunId, filters = {}, options = {}) =>
  useQuery({
    queryKey: ["discovery", "items", discoveryRunId, filters],
    queryFn: () => getDiscoveredItemsApi(discoveryRunId, filters),
    enabled: !!discoveryRunId,
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

export const useRunDiscovery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runDiscoveryApi,
    onSuccess: (res) => {
      const summary = res?.data?.result?.summary ?? {};
      const found = summary.new ?? 0;

      // The count that matters is `new` — the work this created. Leading with
      // "42 items found" buries it under the modems already on file.
      if (found === 0) {
        toast.success(
          `Sweep complete — nothing new (${summary.matched ?? 0} already on file)`,
        );
      } else {
        toast.success(
          `Sweep complete — ${found} modem${found === 1 ? "" : "s"} not in your records`,
        );
      }

      if (summary.orphaned > 0) {
        // Separate and softer: an orphan is usually a fault, not a discovery,
        // and it needs looking at rather than acting on.
        toast.warning(
          `${summary.orphaned} modem${summary.orphaned === 1 ? "" : "s"} on file the OLT did not report`,
        );
      }

      queryClient.invalidateQueries({ queryKey: ["discovery"] });
    },
    onError: (error) => {
      // The API distinguishes "the device refused" from "the OLT is retired",
      // and both are more useful than a generic failure.
      toast.error(error.response?.data?.message || "The sweep could not be completed");
    },
  });
};

export const useImportDiscoveredItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ discoveredItemId, overrides }) =>
      importDiscoveredItemApi(discoveredItemId, overrides),
    onSuccess: () => {
      toast.success("Added to your network inventory");
      queryClient.invalidateQueries({ queryKey: ["discovery"] });
      // The ONU list and the topology both just gained a row.
      queryClient.invalidateQueries({ queryKey: ["onus"] });
      queryClient.invalidateQueries({ queryKey: ["topology"] });
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Could not import this modem");
    },
  });
};
