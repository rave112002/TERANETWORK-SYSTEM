import { Alert, App, Button, Form, Input, Select, Spin, Tooltip } from "antd";
import { Building2, Calendar, Clock, Mail } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import PageHeader from "../../../components/PageHeader";
import SectionLabel from "../../../components/SectionLabel";
import StatusToggle from "../../../components/StatusToggle";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  useGetSettings,
  useUpdateSettings,
} from "../../../services/requests/admin/settings";

const DATE_FORMAT_OPTIONS = [
  { value: "MMM D, YYYY", label: "MMM D, YYYY  (Jan 5, 2025)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD  (2025-01-05)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY  (05/01/2025)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY  (01/05/2025)" },
];

const WEEK_START_OPTIONS = [{ v: "Monday" }, { v: "Sunday" }];

const isFormEqual = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify(a[k] ?? "") !== JSON.stringify(b[k] ?? "")) return false;
  }
  return true;
};

const SettingsPage = () => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("settings", null, "write");

  const { data, isLoading, error } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const initialValuesRef = useRef({});

  const settings = data?.data?.settings;

  useEffect(() => {
    if (settings) {
      form.setFieldsValue(settings);
      initialValuesRef.current = settings;
    }
  }, [settings, form]);

  const watchedValues = Form.useWatch([], form);
  const isDirty = useMemo(
    () => !isFormEqual(watchedValues ?? form.getFieldsValue(), initialValuesRef.current),
    [watchedValues, form],
  );

  const handleSubmit = async () => {
    if (!isDirty) {
      message.info("No changes to save");
      return;
    }
    const values = await form.validateFields();
    updateMutation.mutate(values, {
      onSuccess: (response) => {
        const saved = response?.data?.settings;
        if (saved) {
          form.setFieldsValue(saved);
          initialValuesRef.current = saved;
        }
      },
    });
  };

  if (error) {
    return (
      <div className="p-8">
        <Alert
          type="error"
          showIcon
          message="Failed to load settings"
          description={error.message}
        />
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Manage settings and configuration for your branch."
      />

      <div
        className="max-w-2xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spin size="large" />
          </div>
        ) : (
          <div className="px-[18px] py-5">
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSubmit}
              disabled={!canWrite}
              requiredMark={false}
            >
              <div>
                <SectionLabel>General</SectionLabel>
                <Form.Item
                  name="companyDisplayName"
                  label="Company display name"
                  rules={[{ max: 100, message: "Must be 100 characters or fewer" }]}
                >
                  <Input
                    prefix={
                      <Building2
                        className="w-4 h-4 mr-2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    }
                    placeholder="e.g., Acme Corp"
                    size="large"
                  />
                </Form.Item>

                <Form.Item
                  name="supportEmail"
                  label="Support email"
                  rules={[{ type: "email", message: "Please enter a valid email" }]}
                >
                  <Input
                    prefix={
                      <Mail
                        className="w-4 h-4 mr-2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    }
                    placeholder="support@example.com"
                    size="large"
                  />
                </Form.Item>
              </div>

              <div className="mt-7">
                <SectionLabel>Localization</SectionLabel>
                <Form.Item name="dateFormat" label="Date format">
                  <Select size="large" options={DATE_FORMAT_OPTIONS} />
                </Form.Item>

                <Form.Item name="timezone" label="Timezone">
                  <Input
                    prefix={
                      <Clock
                        className="w-4 h-4 mr-2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    }
                    placeholder="e.g., Asia/Manila"
                    size="large"
                  />
                </Form.Item>

                <Form.Item name="weekStartsOn" label="Week starts on">
                  <StatusToggle
                    options={WEEK_START_OPTIONS.map((o) => ({
                      v: o.v,
                      dot: "var(--color-text-muted)",
                    }))}
                  />
                </Form.Item>
              </div>

              {canWrite && (
                <div
                  className="mt-7 pt-5 flex items-center gap-2 justify-end"
                  style={{ borderTop: "1px solid var(--color-line)" }}
                >
                  <Calendar
                    className="w-3.5 h-3.5"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <span
                    className="mr-auto"
                    style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                  >
                    Applies to your current branch.
                  </span>
                  <Tooltip title={!isDirty ? "No changes to save yet" : undefined}>
                    <span>
                      <Button
                        type="primary"
                        htmlType="submit"
                        disabled={!isDirty}
                        loading={updateMutation.isPending}
                        size="large"
                      >
                        Save Changes
                      </Button>
                    </span>
                  </Tooltip>
                </div>
              )}
            </Form>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
