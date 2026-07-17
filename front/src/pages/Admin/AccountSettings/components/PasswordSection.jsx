import { App, Button, Form, Input, Tooltip } from "antd";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import PasswordStrengthIndicator from "../../../../components/PasswordStrengthIndicator";
import SectionLabel from "../../../../components/SectionLabel";
import { validationRules } from "../../../../utils/validation";

const PasswordSection = () => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [newPassword, setNewPassword] = useState("");

  // Enable Save only once the user has started entering values.
  const watchedValues = Form.useWatch([], form);
  const isDirty = useMemo(() => {
    const v = watchedValues ?? {};
    return Boolean(v.currentPassword || v.newPassword || v.confirmPassword);
  }, [watchedValues]);

  const handleSubmit = async () => {
    // TODO: Call change password API
    message.success("Password changed successfully");
    form.resetFields();
    setNewPassword("");
  };

  const lockPrefix = (
    <Lock className="w-4 h-4 mr-2" style={{ color: "var(--color-text-muted)" }} />
  );

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      requiredMark
      autoComplete="off"
      scrollToFirstError={{ behavior: "smooth", block: "center", focus: true }}
    >
      {/* Current password */}
      <div>
        <SectionLabel>Current password</SectionLabel>

        <Form.Item
          name="currentPassword"
          label="Current password"
          rules={[{ required: true, message: "Current password is required" }]}
        >
          <Input.Password
            prefix={lockPrefix}
            placeholder="Enter current password"
            size="large"
          />
        </Form.Item>
      </div>

      {/* New password */}
      <div className="mt-7">
        <SectionLabel>New password</SectionLabel>

        <Form.Item
          name="newPassword"
          label="New password"
          required
          rules={[validationRules.strongPassword(8)]}
        >
          <Input.Password
            prefix={lockPrefix}
            placeholder="Enter new password"
            size="large"
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Form.Item>

        <PasswordStrengthIndicator password={newPassword} />

        <Form.Item
          name="confirmPassword"
          label="Confirm new password"
          dependencies={["newPassword"]}
          className="mt-4"
          rules={[
            { required: true, message: "Please confirm your new password" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Passwords do not match"));
              },
            }),
          ]}
        >
          <Input.Password
            prefix={lockPrefix}
            placeholder="Confirm new password"
            size="large"
          />
        </Form.Item>
      </div>

      {/* Footer */}
      <div
        className="mt-7 pt-5 flex justify-end"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <Tooltip
          title={!isDirty ? "Enter your new password to continue" : undefined}
        >
          <span>
            <Button
              type="primary"
              htmlType="submit"
              disabled={!isDirty}
              size="large"
            >
              Change Password
            </Button>
          </span>
        </Tooltip>
      </div>
    </Form>
  );
};

export default PasswordSection;
