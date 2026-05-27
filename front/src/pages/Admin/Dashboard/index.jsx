import { Card, Row, Col, Typography } from "antd";
import {
  Users,
  FileText,
  TrendingUp,
  LayoutDashboard,
  Clock,
} from "lucide-react";
import StatCard from "../../../components/StatCard";

const { Title, Text } = Typography;

const Dashboard = () => {
  const statCards = [
    {
      title: "Total Users",
      value: 1234,
      icon: <Users className="w-5 h-5" />,
      color: "from-primary-color to-secondary-color",
      bgColor: "bg-primary-pale",
      textColor: "text-primary-color",
    },
    {
      title: "Active Tasks",
      value: 28,
      icon: <FileText className="w-5 h-5" />,
      color: "from-emerald-400 to-emerald-600",
      bgColor: "bg-emerald-100",
      textColor: "text-emerald-600",
    },
    {
      title: "Revenue This Month",
      value: "$45,678",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "from-orange-400 to-orange-600",
      bgColor: "bg-orange-100",
      textColor: "text-orange-600",
    },
  ];

  return (
    <div className="p-6 space-y-5">
      {/* 1. PAGE HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} className="mb-1! flex items-center gap-3">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-md"
              style={{ background: "var(--gradient-primary)" }}
            >
              <LayoutDashboard className="w-5 h-5 text-white" />
            </div>
            Dashboard
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Overview of your organization
          </Text>
        </div>
      </div>

      {/* 2. STAT CARDS */}
      <Row gutter={[16, 16]}>
        {statCards.map((card, i) => (
          <Col xs={24} sm={12} lg={8} key={i}>
            <StatCard {...card} />
          </Col>
        ))}
      </Row>

      {/* 3. RECENT ACTIVITY */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary-color" />
            <span>Recent Activity</span>
          </div>
        }
        className="shadow-lg border-0"
      >
        <p style={{ color: "var(--color-text-secondary)" }}>
          No recent activity to display
        </p>
      </Card>
    </div>
  );
};

export default Dashboard;
