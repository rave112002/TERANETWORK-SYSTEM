import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import Spinner from "../../../components/Spinner";
import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import ChartCard from "../../../components/charts/ChartCard";
import CategoryBarChart from "../../../components/charts/CategoryBarChart";
import TrendAreaChart from "../../../components/charts/TrendAreaChart";
import RecentCompanies from "./components/RecentCompanies";
import { useDashboardHooks } from "./hooks";
import RefreshButton from "../../../components/RefreshButton";

const Dashboard = () => {
  const {
    statCards,
    planBreakdown,
    companyGrowth,
    recentCompanies,
    days,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useDashboardHooks();

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading dashboard</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview across all companies."
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner size="large" />
        </div>
      ) : (
        <>
          {/* 2. STAT CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {statCards.map((card) => (
              <StatCard key={card.title} {...card} />
            ))}
          </div>

          {/* 3. CHARTS */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            <div className="lg:col-span-7">
              <ChartCard
                title="New companies"
                subtitle={`Companies onboarded per day · last ${days} days`}
              >
                <TrendAreaChart data={companyGrowth} valueLabel="companies" />
              </ChartCard>
            </div>
            <div className="lg:col-span-5">
              <ChartCard
                title="Companies by plan"
                subtitle="Current subscription mix"
              >
                <CategoryBarChart data={planBreakdown} valueLabel="companies" />
              </ChartCard>
            </div>
          </div>

          {/* 4. NEWEST COMPANIES */}
          <RecentCompanies items={recentCompanies} />
        </>
      )}
    </div>
  );
};

export default Dashboard;
