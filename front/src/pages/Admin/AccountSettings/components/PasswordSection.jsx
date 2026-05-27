import { Button, Form, Input, Tooltip, message } from "antd";
import { Lock } from "lucide-react";
import { useMemo, useState } from "react";
import PasswordStrengthIndicator from "../../../../components/PasswordStrengthIndicator";
import { validationRules } from "../../../../utils/validation";

const PasswordSection = () => {
  const [form] = Form.useForm();
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

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      requiredMark={false}
      scrollToFirstError={{ behavior: "smooth", block: "center", focus: true }}
    >
      <Form.Item
        name="currentPassword"
        label="Current Password"
        rules={[{ required: true, message: "Current password is required" }]}
      >
        <Input.Password
          prefix={<Lock className="w-4 h-4 text-gray-400" />}
          placeholder="Enter current password"
          size="large"
          className="rounded-xl"
        />
      </Form.Item>

      <Form.Item
        name="newPassword"
        label="New Password"
        rules={[validationRules.strongPassword(8)]}
      >
        <Input.Password
          prefix={<Lock className="w-4 h-4 text-gray-400" />}
          placeholder="Enter new password"
          size="large"
          className="rounded-xl"
          onChange={(e) => setNewPassword(e.target.value)}
        />
      </Form.Item>

      <PasswordStrengthIndicator password={newPassword} />

      <Form.Item
        name="confirmPassword"
        label="Confirm New Password"
        dependencies={["newPassword"]}
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
          prefix={<Lock className="w-4 h-4 text-gray-400" />}
          placeholder="Confirm new password"
          size="large"
          className="rounded-xl"
        />
      </Form.Item>

      <div className="flex justify-end pt-2">
        <Tooltip title={!isDirty ? "Enter your new password to continue" : undefined}>
          <span>
            <Button
              type="primary"
              htmlType="submit"
              disabled={!isDirty}
              size="large"
              className="rounded-xl"
              style={
                !isDirty
                  ? undefined
                  : {
                      background: "var(--gradient-primary)",
                      border: "none",
                      boxShadow:
                        "0 4px 12px color-mix(in srgb, var(--color-primary-color) 35%, transparent)",
                    }
              }
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
