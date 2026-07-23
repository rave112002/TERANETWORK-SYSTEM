import { ReloadOutlined } from "@ant-design/icons";
import { Alert, Button, Col, Row, Spin } from "antd";

import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import ChartCard from "../../../components/charts/ChartCard";
import CategoryBarChart from "../../../components/charts/CategoryBarChart";
import TrendAreaChart from "../../../components/charts/TrendAreaChart";
import RecentCompanies from "./components/RecentCompanies";
import { useDashboardHooks } from "./hooks";

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
        <Alert
          type="error"
          showIcon
          message="Error loading dashboard"
          description={error.message}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Dashboard"
        subtitle="Platform overview across all companies."
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isFetching}>
            Refresh
          </Button>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Spin size="large" />
        </div>
      ) : (
        <>
          {/* 2. STAT CARDS */}
          <Row gutter={[14, 14]}>
            {statCards.map((card) => (
              <Col xs={24} sm={12} lg={6} key={card.title}>
                <StatCard {...card} />
              </Col>
            ))}
          </Row>

          {/* 3. CHARTS */}
          <Row gutter={[14, 14]}>
            <Col xs={24} lg={14}>
              <ChartCard
                title="New companies"
                subtitle={`Companies onboarded per day · last ${days} days`}
              >
                <TrendAreaChart data={companyGrowth} valueLabel="companies" />
              </ChartCard>
            </Col>
            <Col xs={24} lg={10}>
              <ChartCard title="Companies by plan" subtitle="Current subscription mix">
                <CategoryBarChart data={planBreakdown} valueLabel="companies" />
              </ChartCard>
            </Col>
          </Row>

          {/* 4. NEWEST COMPANIES */}
          <RecentCompanies items={recentCompanies} />
        </>
      )}
    </div>
  );
};

export default Dashboard;
