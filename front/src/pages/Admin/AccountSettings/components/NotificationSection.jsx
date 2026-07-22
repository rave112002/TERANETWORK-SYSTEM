import { useState } from "react";
import StatusToggle from "../../../../components/StatusToggle";

const DEFAULT_PREFS = {
  emailNotifications: true,
  pushNotifications: false,
  securityAlerts: true,
  activityUpdates: true,
};

// There is no server-side notification-delivery system yet, so preferences are
// persisted locally (honestly) rather than faking a server save. Keyed per
// portal so admin/superadmin sessions don't clash.
const storageKey = (portal) => `notification-prefs-${portal}`;

const loadPrefs = (portal) => {
  try {
    const raw = localStorage.getItem(storageKey(portal));
    return raw ? { ...DEFAULT_PREFS, ...JSON.parse(raw) } : DEFAULT_PREFS;
  } catch {
    return DEFAULT_PREFS;
  }
};

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

const NotificationSection = ({ portal = "admin" }) => {
  const [preferences, setPreferences] = useState(() => loadPrefs(portal));

  const handleToggle = (key, next) => {
    setPreferences((prev) => {
      const updated = { ...prev, [key]: next === "On" };
      try {
        localStorage.setItem(storageKey(portal), JSON.stringify(updated));
      } catch {
        // localStorage unavailable — preferences just won't persist
      }
      return updated;
    });
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
