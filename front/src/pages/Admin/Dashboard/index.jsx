import { Col, Row } from "antd";
import { Clock, FileText, TrendingUp, Users } from "lucide-react";

import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";

const Dashboard = () => {
  const statCards = [
    {
      title: "Total users",
      value: 1234,
      icon: <Users className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
    {
      title: "Active tasks",
      value: 28,
      icon: <FileText className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
    {
      title: "Revenue this month",
      value: "$45,678",
      icon: <TrendingUp className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
  ];

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader title="Dashboard" subtitle="Overview of your company" />

      {/* 2. STAT CARDS */}
      <Row gutter={[14, 14]}>
        {statCards.map((card, i) => (
          <Col xs={24} sm={12} lg={8} key={i}>
            <StatCard {...card} />
          </Col>
        ))}
      </Row>

      {/* 3. RECENT ACTIVITY */}
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

        <div className="px-[18px] py-14 text-center">
          <p
            className="m-0"
            style={{ fontSize: 13, color: "var(--color-text-muted)" }}
          >
            No recent activity to display
          </p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
