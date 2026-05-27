import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { getAuditTrailApi } from "../../api/admin/audit-trail";

// Query: Get audit trail logs (paginated + filterable)
export const useGetAuditTrail = (filters = {}) => {
  return useQuery({
    queryKey: ["audit-trail", filters],
    queryFn: () => getAuditTrailApi(filters),
    staleTime: 60 * 1000, // 1 minute — append-only data; Refresh forces a refetch
    placeholderData: keepPreviousData, // keep old rows visible while paginating/filtering
  });
};
