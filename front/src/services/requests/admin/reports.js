import { toast } from "sonner";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

import {
  downloadReportCsvApi,
  getAgingReportApi,
  getCollectionsReportApi,
  getOperationsSummaryApi,
  getSubscriberReportApi,
} from "../../api/admin/reports";

/**
 * The dashboard's single round trip.
 *
 * A short staleTime and a refetch on focus: this is the screen somebody leaves
 * open all morning, and a dead-letter count from two hours ago is exactly the
 * thing it exists to surface.
 */
export const useGetOperationsSummary = (options = {}) =>
  useQuery({
    queryKey: ["reports", "operations"],
    queryFn: getOperationsSummaryApi,
    staleTime: 60 * 1000,
    refetchOnWindowFocus: true,
    ...options,
  });

export const useGetAgingReport = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["reports", "aging", filters],
    queryFn: () => getAgingReportApi(filters),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

export const useGetCollectionsReport = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["reports", "collections", filters],
    queryFn: () => getCollectionsReportApi(filters),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

export const useGetSubscriberReport = (filters = {}, options = {}) =>
  useQuery({
    queryKey: ["reports", "subscribers", filters],
    queryFn: () => getSubscriberReportApi(filters),
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
    ...options,
  });

/**
 * Save a report as a CSV file.
 *
 * A plain function rather than a hook: this is an action somebody takes, not
 * state a component renders, and caching a Blob would hold the whole file in
 * memory for as long as the query key lived.
 *
 * The filename comes from the server's Content-Disposition when it is there —
 * it carries the report's date range and a timestamp, which is what stops three
 * exports in one afternoon from overwriting each other in the Downloads folder.
 *
 * @param {'aging'|'collections'|'subscribers'} report
 * @param {Object} filters
 */
export const downloadReportCsv = async (report, filters = {}) => {
  try {
    const response = await downloadReportCsvApi(report, filters);

    const disposition = response.headers?.["content-disposition"] ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match ? match[1] : `${report}.csv`;

    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    // Released on the next tick — revoking synchronously can cancel the save in
    // Safari before it has finished reading the blob.
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    toast.success(`Exported ${filename}`);
  } catch (error) {
    toast.error(error.response?.data?.message || "Could not export this report");
  }
};
