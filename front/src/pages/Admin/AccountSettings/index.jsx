import { Card, Col, Row, Typography } from "antd";
import { Settings, User, Lock, Bell } from "lucide-react";
import ProfileSection from "./components/ProfileSection";
import PasswordSection from "./components/PasswordSection";
import NotificationSection from "./components/NotificationSection";

const { Title, Text } = Typography;

const AccountSettings = () => {
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
              <Settings className="w-5 h-5 text-white" />
            </div>
            Account Settings
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Manage your profile, security, and preferences
          </Text>
        </div>
      </div>

      {/* 2. SETTINGS SECTIONS */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          {/* Profile Information */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary-color" />
                <span>Profile Information</span>
              </div>
            }
            className="shadow-lg border-0 mb-4"
          >
            <ProfileSection />
          </Card>

          {/* Change Password */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary-color" />
                <span>Change Password</span>
              </div>
            }
            className="shadow-lg border-0"
          >
            <PasswordSection />
          </Card>
        </Col>

        <Col xs={24} lg={8}>
          {/* Notifications */}
          <Card
            title={
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary-color" />
                <span>Notifications</span>
              </div>
            }
            className="shadow-lg border-0 h-full"
          >
            <NotificationSection />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AccountSettings;
