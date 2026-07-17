import { App, Button, Form, Input, Tooltip } from "antd";
import { Mail, Phone, User } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import SectionLabel from "../../../../components/SectionLabel";
import { useAdminAuthStore } from "../../../../store/authStore";

// Dependency-free value compare for the dirty check.
const isFormEqual = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify(a[k] ?? "") !== JSON.stringify(b[k] ?? "")) return false;
  }
  return true;
};

const ProfileSection = () => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { userData } = useAdminAuthStore();
  const initialValuesRef = useRef({});

  useEffect(() => {
    if (userData) {
      const values = {
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        phone: userData.phone,
      };
      form.setFieldsValue(values);
      initialValuesRef.current = values;
    }
  }, [userData, form]);

  // Live dirty flag so Save stays disabled until something actually changes.
  const watchedValues = Form.useWatch([], form);
  const isDirty = useMemo(
    () =>
      !isFormEqual(
        watchedValues ?? form.getFieldsValue(),
        initialValuesRef.current,
      ),
    [watchedValues, form],
  );

  const handleSubmit = async () => {
    if (!isDirty) {
      message.info("No changes to save");
      return;
    }
    // TODO: Call update profile API
    message.success("Profile updated successfully");
    initialValuesRef.current = form.getFieldsValue(); // new baseline after save
  };

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={handleSubmit}
      requiredMark
      autoComplete="off"
      scrollToFirstError={{ behavior: "smooth", block: "center", focus: true }}
    >
      {/* Personal details */}
      <div>
        <SectionLabel>Personal details</SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Form.Item
            name="firstName"
            label="First name"
            rules={[{ required: true, message: "First name is required" }]}
          >
            <Input
              prefix={
                <User
                  className="w-4 h-4 mr-2"
                  style={{ color: "var(--color-text-muted)" }}
                />
              }
              placeholder="e.g., Juan"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="lastName"
            label="Last name"
            rules={[{ required: true, message: "Last name is required" }]}
          >
            <Input
              prefix={
                <User
                  className="w-4 h-4 mr-2"
                  style={{ color: "var(--color-text-muted)" }}
                />
              }
              placeholder="e.g., Dela Cruz"
              size="large"
            />
          </Form.Item>
        </div>
      </div>

      {/* Contact */}
      <div className="mt-7">
        <SectionLabel>Contact</SectionLabel>

        <Form.Item
          name="email"
          label="Email address"
          rules={[
            { required: true, message: "Email is required" },
            { type: "email", message: "Please enter a valid email" },
          ]}
        >
          <Input
            prefix={
              <Mail
                className="w-4 h-4 mr-2"
                style={{ color: "var(--color-text-muted)" }}
              />
            }
            placeholder="juan@example.com"
            size="large"
            disabled
          />
        </Form.Item>

        <Form.Item name="phone" label="Phone number">
          <Input
            prefix={
              <Phone
                className="w-4 h-4 mr-2"
                style={{ color: "var(--color-text-muted)" }}
              />
            }
            placeholder="e.g., +63 912 345 6789"
            size="large"
          />
        </Form.Item>
      </div>

      {/* Footer */}
      <div
        className="mt-7 pt-5 flex justify-end"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <Tooltip title={!isDirty ? "No changes to save yet" : undefined}>
          <span>
            <Button
              type="primary"
              htmlType="submit"
              disabled={!isDirty}
              size="large"
            >
              Save Changes
            </Button>
          </span>
        </Tooltip>
      </div>
    </Form>
  );
};

export default ProfileSection;
