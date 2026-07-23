import { useQuery } from "@tanstack/react-query";
import { getDashboardStatsApi } from "../../api/superadmin/dashboard";

export const useGetDashboardStats = () =>
  useQuery({
    queryKey: ["dashboard-stats", "superadmin"],
    queryFn: getDashboardStatsApi,
    staleTime: 60 * 1000,
  });
