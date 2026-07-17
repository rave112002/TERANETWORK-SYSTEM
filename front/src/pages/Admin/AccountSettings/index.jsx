import { Col, Row } from "antd";
import { Bell, Lock, User } from "lucide-react";
import PageHeader from "../../../components/PageHeader";
import ProfileSection from "./components/ProfileSection";
import PasswordSection from "./components/PasswordSection";
import NotificationSection from "./components/NotificationSection";

/**
 * Flat settings panel — hairline border, radius 14, no shadow. The heading row
 * is separated from the body by a hairline rule (same chrome as the list card).
 */
const SettingsPanel = ({ title, description, icon, className = "", children }) => (
  <div
    className={className}
    style={{
      background: "var(--color-surface)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div
      className="flex items-center gap-3 px-[18px] py-3.5"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      <span className="shrink-0" style={{ color: "var(--color-text-muted)" }}>
        {icon}
      </span>
      <div className="min-w-0">
        <h2
          className="m-0 font-semibold leading-tight"
          style={{ fontSize: 15, color: "var(--color-text-dark)" }}
        >
          {title}
        </h2>
        <p
          className="m-0 mt-0.5"
          style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
        >
          {description}
        </p>
      </div>
    </div>
    <div className="px-[18px] py-5">{children}</div>
  </div>
);

const AccountSettings = () => {
  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Account Settings"
        subtitle="Manage your profile, security, and preferences."
      />

      {/* 2. SETTINGS PANELS */}
      <Row gutter={[14, 14]}>
        <Col xs={24} lg={16}>
          <div className="space-y-3.5">
            <SettingsPanel
              title="Profile Information"
              description="Your name and how we reach you."
              icon={<User className="w-4.25 h-4.25" strokeWidth={1.8} />}
            >
              <ProfileSection />
            </SettingsPanel>

            <SettingsPanel
              title="Change Password"
              description="Update the password you use to sign in."
              icon={<Lock className="w-4.25 h-4.25" strokeWidth={1.8} />}
            >
              <PasswordSection />
            </SettingsPanel>
          </div>
        </Col>

        <Col xs={24} lg={8}>
          <SettingsPanel
            title="Notifications"
            description="Choose what you get told about."
            icon={<Bell className="w-4.25 h-4.25" strokeWidth={1.8} />}
            className="h-full"
          >
            <NotificationSection />
          </SettingsPanel>
        </Col>
      </Row>
    </div>
  );
};

export default AccountSettings;
