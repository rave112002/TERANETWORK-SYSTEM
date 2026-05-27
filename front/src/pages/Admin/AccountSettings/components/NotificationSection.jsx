import { Switch } from "antd";
import { useState } from "react";

const NotificationSection = () => {
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    securityAlerts: true,
    activityUpdates: true,
  });

  const handleToggle = (key) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    // TODO: Call update notification preferences API
  };

  const items = [
    {
      key: "emailNotifications",
      label: "Email Notifications",
      description: "Receive updates via email",
    },
    {
      key: "pushNotifications",
      label: "Push Notifications",
      description: "Browser push notifications",
    },
    {
      key: "securityAlerts",
      label: "Security Alerts",
      description: "Login attempts and password changes",
    },
    {
      key: "activityUpdates",
      label: "Activity Updates",
      description: "Team activity and mentions",
    },
  ];

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <div
          key={item.key}
          className="flex items-center justify-between p-3 rounded-xl hover:bg-gray-50 transition-colors"
        >
          <div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--color-text-dark)" }}
            >
              {item.label}
            </p>
            <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>
              {item.description}
            </p>
          </div>
          <Switch
            checked={preferences[item.key]}
            onChange={() => handleToggle(item.key)}
            size="small"
          />
        </div>
      ))}
    </div>
  );
};

export default NotificationSection;
