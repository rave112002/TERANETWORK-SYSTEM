import { Col, Progress, Row, Table } from "antd";
import {
  Activity,
  AlertCircle,
  Building2,
  CheckCircle,
  Clock,
  CreditCard,
  Database,
  FileText,
  MapPin,
  Server,
  Settings,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";

import PageHeader from "../../../components/PageHeader";
import StatCard from "../../../components/StatCard";

/**
 * Section panel — hairline border, radius 14, no shadow. The header carries a
 * dim lucide icon, the title, and an optional right-hand action.
 */
const Panel = ({
  icon,
  title,
  extra,
  className = "",
  bodyClass = "p-[18px]",
  children,
}) => (
  <div
    className={`flex flex-col overflow-hidden ${className}`}
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div
      className="flex items-center justify-between gap-3 px-[18px] py-3.5"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="shrink-0" style={{ color: "var(--color-text-muted)" }}>
          {icon}
        </span>
        <span
          className="truncate"
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: "var(--color-text-dark)",
          }}
        >
          {title}
        </span>
      </div>
      {extra}
    </div>
    <div className={`flex-1 ${bodyClass}`}>{children}</div>
  </div>
);

const ViewAllLink = () => (
  <button
    className="shrink-0 cursor-pointer hover:underline"
    style={{ fontSize: 12.5, color: "var(--color-link)" }}
  >
    View all
  </button>
);

const Dashboard = () => {
  const statCards = [
    {
      title: "Total companies",
      value: 48,
      change: "+8 this month",
      icon: <Building2 className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
    {
      title: "Active companies",
      value: 45,
      change: "93.8% active rate",
      icon: <CheckCircle className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
    {
      title: "Total branches",
      value: 156,
      change: "+12 this month",
      icon: <MapPin className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
    {
      title: "Monthly revenue",
      value: "$24K",
      change: "+12.5% growth",
      icon: <TrendingUp className="w-4.25 h-4.25" strokeWidth={1.8} />,
    },
  ];

  const systemStats = [
    {
      title: "Database status",
      value: "Healthy",
      icon: <Database className="w-4 h-4" strokeWidth={1.8} />,
      status: "success",
    },
    {
      title: "Server load",
      value: "45%",
      icon: <Server className="w-4 h-4" strokeWidth={1.8} />,
      status: "success",
    },
    {
      title: "Active sessions",
      value: "234",
      icon: <Users className="w-4 h-4" strokeWidth={1.8} />,
      status: "success",
    },
    {
      title: "Alerts",
      value: "2",
      icon: <AlertCircle className="w-4 h-4" strokeWidth={1.8} />,
      status: "warning",
    },
  ];

  const recentCompanies = [
    {
      key: "1",
      name: "Acme Corporation",
      city: "New York",
      branches: 5,
      status: "active",
      subscription: "Premium",
    },
    {
      key: "2",
      name: "TechStart Inc.",
      city: "San Francisco",
      branches: 3,
      status: "active",
      subscription: "Standard",
    },
    {
      key: "3",
      name: "Global Services Ltd.",
      city: "Chicago",
      branches: 8,
      status: "active",
      subscription: "Enterprise",
    },
    {
      key: "4",
      name: "StartUp Hub",
      city: "Austin",
      branches: 2,
      status: "inactive",
      subscription: "Basic",
    },
  ];

  const recentActivities = [
    {
      id: 1,
      type: "company",
      icon: <Building2 className="w-4 h-4" strokeWidth={1.8} />,
      title: "New company registered",
      description: "Acme Corporation joined the platform",
      time: "5 minutes ago",
    },
    {
      id: 2,
      type: "user",
      icon: <UserPlus className="w-4 h-4" strokeWidth={1.8} />,
      title: "New admin user created",
      description: "John Smith added to TechStart Inc.",
      time: "15 minutes ago",
    },
    {
      id: 3,
      type: "subscription",
      icon: <CreditCard className="w-4 h-4" strokeWidth={1.8} />,
      title: "Subscription upgraded",
      description: "Global Services upgraded to Enterprise plan",
      time: "1 hour ago",
    },
    {
      id: 4,
      type: "document",
      icon: <FileText className="w-4 h-4" strokeWidth={1.8} />,
      title: "Document submitted",
      description: "StartUp Hub submitted compliance documents",
      time: "2 hours ago",
    },
    {
      id: 5,
      type: "system",
      icon: <Settings className="w-4 h-4" strokeWidth={1.8} />,
      title: "System maintenance completed",
      description: "Database optimization finished successfully",
      time: "3 hours ago",
    },
  ];

  // Plan tiers ramp muted → accent green; they're a scale, not a severity.
  const subscriptionData = [
    {
      plan: "Basic",
      count: 8,
      color: "var(--color-text-muted)",
      revenue: "$12K",
    },
    {
      plan: "Standard",
      count: 15,
      color: "var(--color-secondary-light)",
      revenue: "$45K",
    },
    {
      plan: "Premium",
      count: 18,
      color: "var(--color-secondary-color)",
      revenue: "$108K",
    },
    {
      plan: "Enterprise",
      count: 7,
      color: "var(--color-secondary-dark)",
      revenue: "$77K",
    },
  ];

  const systemAlerts = [
    {
      id: 1,
      icon: <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" strokeWidth={1.8} />,
      color: "var(--color-warning)",
      title: "Payment pending",
      description: "2 companies have pending subscription payments",
      meta: "Requires attention",
    },
    {
      id: 2,
      icon: <AlertCircle className="w-4.5 h-4.5 shrink-0 mt-0.5" strokeWidth={1.8} />,
      color: "var(--color-warning)",
      title: "Document verification",
      description: "3 companies awaiting document verification",
      meta: "Review required",
    },
    {
      id: 3,
      icon: <Activity className="w-4.5 h-4.5 shrink-0 mt-0.5" strokeWidth={1.8} />,
      color: "var(--color-text-muted)",
      title: "System update available",
      description: "New version 2.5.0 is ready to install",
      meta: "Optional update",
    },
  ];

  const companyColumns = [
    {
      title: "Company",
      dataIndex: "name",
      key: "name",
      render: (text, record) => {
        const initial = (text?.trim().charAt(0) || "?").toUpperCase();
        return (
          <div className="flex items-center gap-3 min-w-0">
            <span
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "none",
                fontSize: 13,
                fontWeight: 600,
                color: "var(--color-text-secondary)",
              }}
            >
              {initial}
            </span>
            <div className="min-w-0">
              <div
                className="truncate"
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--color-text-dark)",
                }}
              >
                {text}
              </div>
              <div
                className="flex items-center gap-1"
                style={{ fontSize: 12, color: "var(--color-text-muted)" }}
              >
                <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.8} />
                {record.city}
              </div>
            </div>
          </div>
        );
      },
    },
    {
      title: "Branches",
      dataIndex: "branches",
      key: "branches",
      align: "center",
      render: (count) => (
        <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
          {count}
        </span>
      ),
    },
    {
      title: "Subscription",
      dataIndex: "subscription",
      key: "subscription",
      render: (plan) => (
        <span
          className="inline-flex items-center"
          style={{
            height: 22,
            padding: "0 8px",
            borderRadius: 6,
            background: "var(--color-surface-sunken)",
            border: "1px solid var(--color-line)",
            fontSize: 12,
            color: "var(--color-text-secondary)",
          }}
        >
          {plan}
        </span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => {
        const active = status === "active";
        return (
          <span
            className="inline-flex items-center gap-2"
            style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: "50%",
                background: active
                  ? "var(--color-success)"
                  : "var(--color-text-muted)",
                boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
              }}
            />
            {active ? "Active" : "Inactive"}
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="SuperAdmin Dashboard"
        subtitle="System overview and management console"
      />

      {/* 2. STAT CARDS */}
      <Row gutter={[14, 14]}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      {/* 3. SYSTEM STATUS */}
      <Panel
        icon={<Activity className="w-4 h-4" strokeWidth={1.8} />}
        title="System status"
      >
        <Row gutter={[14, 14]}>
          {systemStats.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <div
                className="flex items-center gap-3 p-3.5"
                style={{
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "var(--radius-control)",
                }}
              >
                <span
                  className="inline-flex items-center justify-center shrink-0"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-line)",
                    color: "var(--color-text-muted)",
                  }}
                >
                  {stat.icon}
                </span>
                <div className="min-w-0">
                  <div
                    className="truncate"
                    style={{
                      fontSize: 12.5,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    {stat.title}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {/* the dot carries the health signal, so the icon stays dim */}
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        flex: "none",
                        background:
                          stat.status === "success"
                            ? "var(--color-success)"
                            : "var(--color-warning)",
                      }}
                    />
                    <span
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--color-text-dark)",
                      }}
                    >
                      {stat.value}
                    </span>
                  </div>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Panel>

      {/* 4. RECENT COMPANIES & SUBSCRIPTION */}
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={16}>
          <Panel
            icon={<Building2 className="w-4 h-4" strokeWidth={1.8} />}
            title="Recent companies"
            extra={<ViewAllLink />}
            className="h-full"
            bodyClass=""
          >
            <Table
              columns={companyColumns}
              dataSource={recentCompanies}
              pagination={false}
              size="middle"
              className="border-none"
            />
          </Panel>
        </Col>

        <Col xs={24} lg={8}>
          <Panel
            icon={<CreditCard className="w-4 h-4" strokeWidth={1.8} />}
            title="Subscription overview"
            className="h-full"
          >
            <div className="space-y-4">
              {subscriptionData.map((sub, index) => (
                <div key={index} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          flex: "none",
                          background: sub.color,
                        }}
                      />
                      <span
                        className="truncate"
                        style={{
                          fontSize: 13.5,
                          fontWeight: 500,
                          color: "var(--color-text-dark)",
                        }}
                      >
                        {sub.plan}
                      </span>
                    </div>
                    <span
                      className="shrink-0"
                      style={{
                        fontSize: 12.5,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {sub.count} companies
                    </span>
                  </div>
                  <Progress
                    percent={(sub.count / 48) * 100}
                    strokeColor={sub.color}
                    trailColor="var(--color-surface-sunken)"
                    showInfo={false}
                    size="small"
                  />
                  <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                    {sub.revenue}
                  </span>
                </div>
              ))}

              <div
                className="pt-4 mt-4"
                style={{ borderTop: "1px solid var(--color-line)" }}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    style={{
                      fontSize: 13.5,
                      fontWeight: 500,
                      color: "var(--color-text-secondary)",
                    }}
                  >
                    Total revenue
                  </span>
                  <span
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      letterSpacing: "-0.3px",
                      color: "var(--color-text-dark)",
                    }}
                  >
                    $242K
                  </span>
                </div>
              </div>
            </div>
          </Panel>
        </Col>
      </Row>

      {/* 5. RECENT ACTIVITY & ALERTS */}
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={16}>
          <Panel
            icon={<Clock className="w-4 h-4" strokeWidth={1.8} />}
            title="Recent activity"
            extra={<ViewAllLink />}
            className="h-full"
          >
            <div className="space-y-2.5">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3"
                  style={{
                    background: "var(--color-surface-sunken)",
                    border: "1px solid var(--color-line)",
                    borderRadius: "var(--radius-control)",
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center shrink-0"
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 8,
                      background: "var(--color-surface)",
                      border: "1px solid var(--color-line)",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {activity.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: "var(--color-text-dark)",
                      }}
                    >
                      {activity.title}
                    </div>
                    <div
                      className="truncate"
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {activity.description}
                    </div>
                    <div
                      className="flex items-center gap-1 mt-1"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      <Clock className="w-3 h-3 shrink-0" strokeWidth={1.8} />
                      {activity.time}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Col>

        <Col xs={24} lg={8}>
          <Panel
            icon={<AlertCircle className="w-4 h-4" strokeWidth={1.8} />}
            title="System alerts"
            extra={<ViewAllLink />}
            className="h-full"
          >
            <div className="space-y-2.5">
              {systemAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="flex items-start gap-3 p-3"
                  style={{
                    background: "var(--color-surface-sunken)",
                    border: "1px solid var(--color-line)",
                    borderRadius: "var(--radius-control)",
                  }}
                >
                  {/* severity stays meaningful: the icon carries the tone */}
                  <span style={{ color: alert.color }} className="shrink-0">
                    {alert.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 500,
                        color: "var(--color-text-dark)",
                      }}
                    >
                      {alert.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {alert.description}
                    </div>
                    <div
                      className="mt-1"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      {alert.meta}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
