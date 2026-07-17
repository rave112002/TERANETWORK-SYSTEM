import { Settings } from "lucide-react";
import PageHeader from "../../../components/PageHeader";

const SettingsPage = () => {
  return (
    <div className="p-8 space-y-5">
      {/* 1. HEADER */}
      <PageHeader
        title="Settings"
        subtitle="Manage system settings and configurations."
      />

      {/* 2. PLACEHOLDER PANEL */}
      <div
        className="flex flex-col items-center justify-center text-center px-6 py-20"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <span
          className="inline-flex items-center justify-center mb-4"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--color-surface-sunken)",
            border: "1px solid var(--color-line)",
            color: "var(--color-text-muted)",
          }}
        >
          <Settings className="w-5 h-5" strokeWidth={1.8} />
        </span>
        <p
          className="m-0 font-semibold"
          style={{ fontSize: 15, color: "var(--color-text-dark)" }}
        >
          Nothing to configure yet
        </p>
        <p
          className="m-0 mt-1"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          Settings management is coming soon.
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
