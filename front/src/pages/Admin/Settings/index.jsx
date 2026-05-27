import { Typography } from "antd";
import { Settings } from "lucide-react";

const { Title, Text } = Typography;

const SettingsPage = () => {
  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <Title level={2} className="mb-1! flex items-center gap-3">
            <div
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl shadow-md"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Settings className="w-5 h-5 text-white" />
            </div>
            Settings
          </Title>
          <Text
            style={{ color: "var(--color-text-secondary)" }}
            className="text-sm"
          >
            Manage system settings and configurations
          </Text>
        </div>
      </div>

      <div className="rounded-2xl bg-white ring-1 ring-gray-100 p-12 text-center">
        <Settings className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <Text className="text-gray-500">Settings management coming soon</Text>
      </div>
    </div>
  );
};

export default SettingsPage;
