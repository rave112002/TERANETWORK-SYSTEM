import { useState } from "react";
import StatusToggle from "../../../../components/StatusToggle";

// Two-option choice → segmented toggle, not a Switch.
const TOGGLE_OPTIONS = [
  { v: "On", dot: "var(--color-success)" },
  { v: "Off", dot: "var(--color-text-muted)" },
];

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

const NotificationSection = () => {
  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    pushNotifications: false,
    securityAlerts: true,
    activityUpdates: true,
  });

  const handleToggle = (key, next) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: next === "On",
    }));
    // TODO: Call update notification preferences API
  };

  return (
    <div>
      {items.map((item, index) => (
        <div
          key={item.key}
          className={`py-4 ${index === 0 ? "pt-0" : ""} ${
            index === items.length - 1 ? "pb-0" : ""
          }`}
          style={
            index === 0
              ? undefined
              : { borderTop: "1px solid var(--color-line-soft)" }
          }
        >
          <div className="min-w-0">
            <p
              className="m-0 font-medium"
              style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}
            >
              {item.label}
            </p>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              {item.description}
            </p>
          </div>
          <div className="mt-2.5">
            <StatusToggle
              value={preferences[item.key] ? "On" : "Off"}
              onChange={(next) => handleToggle(item.key, next)}
              options={TOGGLE_OPTIONS}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

export default NotificationSection;
