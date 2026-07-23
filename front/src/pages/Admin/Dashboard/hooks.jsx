import { useMemo } from "react";
import { Activity, ShieldCheck, UserCheck, Users } from "lucide-react";
import { useGetDashboardStats } from "../../../services/requests/admin/dashboard";

export const useDashboardHooks = () => {
  const { data, isLoading, error, refetch, isFetching } =
    useGetDashboardStats();

  const payload = data?.data;
  const stats = payload?.stats;
  const days = stats?.seriesDays ?? 14;

  const statCards = useMemo(
    () => [
      {
        title: "Total users",
        value: stats?.totalUsers ?? 0,
        change: "in this branch",
        icon: <Users className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
      {
        title: "Active users",
        value: stats?.activeUsers ?? 0,
        change: "currently active",
        icon: <UserCheck className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
      {
        title: "Roles",
        value: stats?.totalRoles ?? 0,
        change: "configured",
        icon: <ShieldCheck className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
      {
        title: "Audit events",
        value: stats?.auditEvents ?? 0,
        change: `last ${days} days`,
        icon: <Activity className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
    ],
    [stats, days],
  );

  return {
    statCards,
    userGrowth: payload?.userGrowth ?? [],
    activityByDay: payload?.activityByDay ?? [],
    recentActivity: payload?.recentActivity ?? [],
    days,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};
