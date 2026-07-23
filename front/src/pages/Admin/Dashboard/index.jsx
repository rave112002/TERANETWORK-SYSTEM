import { Alert, Button, Col, Row, Spin } from "antd";
import dayjs from "dayjs";
import { Clock } from "lucide-react";

import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";
import ChartCard from "../../../components/charts/ChartCard";
import TrendAreaChart from "../../../components/charts/TrendAreaChart";
import { decodeHTML } from "../../../utils/decode-html";
import { useDashboardHooks } from "./hooks";
import RefreshButton from "../../../components/RefreshButton";

const RecentActivity = ({ items }) => (
  <div
    className="overflow-hidden"
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div
      className="flex items-center gap-2 px-[18px] py-3.5"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      <Clock
        className="w-4 h-4 shrink-0"
        strokeWidth={1.8}
        style={{ color: "var(--color-text-muted)" }}
      />
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--color-text-dark)",
        }}
      >
        Recent activity
      </span>
    </div>

    {items.length === 0 ? (
      <div className="px-[18px] py-14 text-center">
        <p
          className="m-0"
          style={{ fontSize: 13, color: "var(--color-text-muted)" }}
        >
          No recent activity to display
        </p>
      </div>
    ) : (
      <div>
        {items.map((item, i) => (
          <div
            key={item.auditId}
            className="flex items-start justify-between gap-4 px-[18px] py-3"
            style={
              i === 0
                ? undefined
                : { borderTop: "1px solid var(--color-line-soft)" }
            }
          >
            <div className="min-w-0">
              <p
                className="m-0 font-medium truncate"
                style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
              >
                {decodeHTML(item.description) || item.action}
              </p>
              <p
                className="m-0 mt-0.5 truncate"
                style={{ fontSize: 12, color: "var(--color-text-muted)" }}
              >
                {[
                  item.module,
                  [item.firstName, item.lastName].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <span
              className="shrink-0"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              {dayjs(item.dateCreated).format("MMM D, h:mm A")}
            </span>
          </div>
        ))}
      </div>
    )}
  </div>
);

const Dashboard = () => {
  const {
    statCards,
    userGrowth,
    activityByDay,
    recentActivity,
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
        subtitle="Overview of your branch."
        actions={<RefreshButton onRefresh={refetch} isFetching={isFetching} />}
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
            <Col xs={24} lg={12}>
              <ChartCard
                title="New users"
                subtitle={`Users added per day · last ${days} days`}
              >
                <TrendAreaChart data={userGrowth} valueLabel="users" />
              </ChartCard>
            </Col>
            <Col xs={24} lg={12}>
              <ChartCard
                title="Activity"
                subtitle={`Audit events per day · last ${days} days`}
              >
                <TrendAreaChart data={activityByDay} valueLabel="events" />
              </ChartCard>
            </Col>
          </Row>

          {/* 4. RECENT ACTIVITY */}
          <RecentActivity items={recentActivity} />
        </>
      )}
    </div>
  );
};

export default Dashboard;
