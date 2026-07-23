import { useQuery } from "@tanstack/react-query";
import { getDashboardStatsApi } from "../../api/admin/dashboard";

export const useGetDashboardStats = () =>
  useQuery({
    queryKey: ["dashboard-stats", "admin"],
    queryFn: getDashboardStatsApi,
    staleTime: 60 * 1000,
  });
