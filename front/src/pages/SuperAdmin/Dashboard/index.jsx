import { Card, Col, Row, Table, Tag, Avatar, Progress, Typography } from "antd";
import {
  Users,
  Building2,
  Activity,
  TrendingUp,
  ShieldCheck,
  Database,
  Server,
  AlertCircle,
  MapPin,
  CheckCircle,
  Clock,
  UserPlus,
  FileText,
  Settings,
  CreditCard,
} from "lucide-react";
import StatCard from "../../../components/StatCard";

const { Title, Text } = Typography;

const Dashboard = () => {
  const statCards = [
    {
      title: "Total Organizations",
      value: 48,
      icon: <Building2 className="w-5 h-5" />,
      color: "from-primary-color to-secondary-color",
      bgColor: "bg-primary-pale",
      textColor: "text-primary-color",
      change: "+8 this month",
    },
    {
      title: "Active Organizations",
      value: 45,
      icon: <CheckCircle className="w-5 h-5" />,
      color: "from-emerald-400 to-emerald-600",
      bgColor: "bg-emerald-100",
      textColor: "text-emerald-600",
      change: "93.8% active rate",
    },
    {
      title: "Total Branches",
      value: 156,
      icon: <MapPin className="w-5 h-5" />,
      color: "from-secondary-color to-secondary-dark",
      bgColor: "bg-secondary-pale",
      textColor: "text-secondary-color",
      change: "+12 this month",
    },
    {
      title: "Monthly Revenue",
      value: "$24K",
      icon: <TrendingUp className="w-5 h-5" />,
      color: "from-orange-400 to-orange-600",
      bgColor: "bg-orange-100",
      textColor: "text-orange-600",
      change: "+12.5% growth",
    },
  ];

  const systemStats = [
    {
      title: "Database Status",
      value: "Healthy",
      icon: <Database className="w-5 h-5" />,
      status: "success",
    },
    {
      title: "Server Load",
      value: "45%",
      icon: <Server className="w-5 h-5" />,
      status: "success",
    },
    {
      title: "Active Sessions",
      value: "234",
      icon: <Users className="w-5 h-5" />,
      status: "success",
    },
    {
      title: "Alerts",
      value: "2",
      icon: <AlertCircle className="w-5 h-5" />,
      status: "warning",
    },
  ];

  const recentOrganizations = [
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
      type: "organization",
      icon: <Building2 className="w-4 h-4" />,
      title: "New organization registered",
      description: "Acme Corporation joined the platform",
      time: "5 minutes ago",
    },
    {
      id: 2,
      type: "user",
      icon: <UserPlus className="w-4 h-4" />,
      title: "New admin user created",
      description: "John Smith added to TechStart Inc.",
      time: "15 minutes ago",
    },
    {
      id: 3,
      type: "subscription",
      icon: <CreditCard className="w-4 h-4" />,
      title: "Subscription upgraded",
      description: "Global Services upgraded to Enterprise plan",
      time: "1 hour ago",
    },
    {
      id: 4,
      type: "document",
      icon: <FileText className="w-4 h-4" />,
      title: "Document submitted",
      description: "StartUp Hub submitted compliance documents",
      time: "2 hours ago",
    },
    {
      id: 5,
      type: "system",
      icon: <Settings className="w-4 h-4" />,
      title: "System maintenance completed",
      description: "Database optimization finished successfully",
      time: "3 hours ago",
    },
  ];

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
      color: "var(--color-primary-color)",
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
      color: "var(--color-warning)",
      revenue: "$77K",
    },
  ];

  const organizationColumns = [
    {
      title: "Organization",
      dataIndex: "name",
      key: "name",
      render: (text, record) => (
        <div className="flex items-center gap-2">
          <Avatar
            size={32}
            icon={<Building2 className="w-4 h-4" />}
            className="bg-primary-pale text-primary-color"
          />
          <div>
            <div className="font-semibold text-text-dark">{text}</div>
            <div className="text-xs text-text-secondary flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {record.city}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: "Branches",
      dataIndex: "branches",
      key: "branches",
      align: "center",
      render: (count) => <span className="font-medium">{count}</span>,
    },
    {
      title: "Subscription",
      dataIndex: "subscription",
      key: "subscription",
      render: (plan) => {
        const colors = {
          Basic: "default",
          Standard: "blue",
          Premium: "purple",
          Enterprise: "gold",
        };
        return <Tag color={colors[plan]}>{plan}</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status) => (
        <Tag color={status === "active" ? "success" : "default"}>
          {status === "active" ? "Active" : "Inactive"}
        </Tag>
      ),
    },
  ];

  const getActivityColor = (type) => {
    const colors = {
      organization: "bg-primary-pale text-primary-color",
      user: "bg-emerald-100 text-emerald-600",
      subscription: "bg-secondary-pale text-secondary-color",
      document: "bg-orange-100 text-orange-600",
      system: "bg-gray-100 text-gray-600",
    };
    return colors[type] || colors.system;
  };

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
              <ShieldCheck className="w-5 h-5 text-white" />
            </div>
            SuperAdmin Dashboard
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            System overview and management console
          </Text>
        </div>
      </div>

      {/* 2. STAT CARDS */}
      <Row gutter={[16, 16]}>
        {statCards.map((stat, index) => (
          <Col xs={24} sm={12} lg={6} key={index}>
            <StatCard {...stat} />
          </Col>
        ))}
      </Row>

      {/* 3. SYSTEM STATUS */}
      <Card
        title={
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary-color" />
            <span>System Status</span>
          </div>
        }
        className="shadow-lg border-0"
      >
        <Row gutter={[16, 16]}>
          {systemStats.map((stat, index) => (
            <Col xs={24} sm={12} lg={6} key={index}>
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200">
                <div
                  className={`p-3 rounded-xl ${
                    stat.status === "success"
                      ? "bg-emerald-100 text-emerald-600"
                      : "bg-orange-100 text-orange-600"
                  }`}
                >
                  {stat.icon}
                </div>
                <div>
                  <Text
                    style={{ color: "var(--color-text-secondary)" }}
                    className="text-sm block"
                  >
                    {stat.title}
                  </Text>
                  <Text className="text-lg font-semibold">{stat.value}</Text>
                </div>
              </div>
            </Col>
          ))}
        </Row>
      </Card>

      {/* 4. RECENT ORGANIZATIONS & SUBSCRIPTION */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary-color" />
                <span>Recent Organizations</span>
              </div>
            }
            className="shadow-lg border-0"
            extra={
              <Text
                className="cursor-pointer hover:underline"
                style={{ color: "var(--color-primary-color)" }}
              >
                View All
              </Text>
            }
          >
            <Table
              columns={organizationColumns}
              dataSource={recentOrganizations}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-secondary-color" />
                <span>Subscription Overview</span>
              </div>
            }
            className="shadow-lg border-0 h-full"
          >
            <div className="space-y-4">
              {subscriptionData.map((sub, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: sub.color }}
                      ></div>
                      <Text className="font-medium">{sub.plan}</Text>
                    </div>
                    <Text style={{ color: "var(--color-text-secondary)" }}>
                      {sub.count} organizations
                    </Text>
                  </div>
                  <Progress
                    percent={(sub.count / 48) * 100}
                    strokeColor={sub.color}
                    showInfo={false}
                    size="small"
                  />
                  <Text
                    style={{ color: "var(--color-text-muted)" }}
                    className="text-xs"
                  >
                    {sub.revenue}
                  </Text>
                </div>
              ))}
              <div className="pt-4 mt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <Text className="font-semibold">Total Revenue</Text>
                  <Text className="text-lg font-bold text-secondary-color">
                    $242K
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 5. RECENT ACTIVITY & ALERTS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-emerald-600" />
                <span>Recent Activity</span>
              </div>
            }
            className="shadow-lg border-0 h-full"
            extra={
              <Text
                className="cursor-pointer hover:underline"
                style={{ color: "var(--color-primary-color)" }}
              >
                View All
              </Text>
            }
          >
            <div className="space-y-3">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors duration-200"
                >
                  <div
                    className={`p-2 rounded-lg ${getActivityColor(activity.type)}`}
                  >
                    {activity.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Text className="block font-medium text-text-dark">
                      {activity.title}
                    </Text>
                    <Text className="text-sm text-text-secondary block truncate">
                      {activity.description}
                    </Text>
                    <Text className="text-xs text-text-muted mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {activity.time}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          <Card
            title={
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-orange-600" />
                <span>System Alerts</span>
              </div>
            }
            className="shadow-lg border-0 h-full"
            extra={
              <Text
                className="cursor-pointer hover:underline"
                style={{ color: "var(--color-primary-color)" }}
              >
                View All
              </Text>
            }
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-xl border border-orange-200">
                <AlertCircle className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Text className="block font-medium text-text-dark">
                    Payment Pending
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    2 organizations have pending subscription payments
                  </Text>
                  <Text className="text-xs text-text-muted mt-1">
                    Requires attention
                  </Text>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-200">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Text className="block font-medium text-text-dark">
                    Document Verification
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    3 organizations awaiting document verification
                  </Text>
                  <Text className="text-xs text-text-muted mt-1">
                    Review required
                  </Text>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-primary-pale rounded-xl border border-primary-pale">
                <Activity className="w-5 h-5 text-primary-color shrink-0 mt-0.5" />
                <div className="flex-1">
                  <Text className="block font-medium text-text-dark">
                    System Update Available
                  </Text>
                  <Text className="text-sm text-text-secondary">
                    New version 2.5.0 is ready to install
                  </Text>
                  <Text className="text-xs text-text-muted mt-1">
                    Optional update
                  </Text>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard;
