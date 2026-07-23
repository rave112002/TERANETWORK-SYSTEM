import { useMemo } from "react";
import { Building2, CheckCircle, MapPin, Users } from "lucide-react";
import { useGetDashboardStats } from "../../../services/requests/superadmin/dashboard";

export const useDashboardHooks = () => {
  const { data, isLoading, error, refetch, isFetching } =
    useGetDashboardStats();

  const payload = data?.data;
  const stats = payload?.stats;
  const days = stats?.seriesDays ?? 14;

  const statCards = useMemo(
    () => [
      {
        title: "Companies",
        value: stats?.totalCompanies ?? 0,
        change: "all time",
        icon: <Building2 className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
      {
        title: "Active companies",
        value: stats?.activeCompanies ?? 0,
        change: "currently active",
        icon: <CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
      {
        title: "Branches",
        value: stats?.totalBranches ?? 0,
        change: "across all companies",
        icon: <MapPin className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
      {
        title: "Users",
        value: stats?.totalUsers ?? 0,
        change: "platform-wide",
        icon: <Users className="w-4.25 h-4.25" strokeWidth={1.8} />,
      },
    ],
    [stats],
  );

  // CategoryBarChart expects { label, value }
  const planBreakdown = useMemo(
    () =>
      (payload?.companiesByPlan ?? []).map((p) => ({
        label: p.plan,
        value: p.count,
      })),
    [payload],
  );

  return {
    statCards,
    planBreakdown,
    companyGrowth: payload?.companyGrowth ?? [],
    recentCompanies: payload?.recentCompanies ?? [],
    days,
    isLoading,
    isFetching,
    error,
    refetch,
  };
};
