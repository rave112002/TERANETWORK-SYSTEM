import { Button, Form, Input, Tooltip, message } from "antd";
import { Mail, Phone, User } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
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
    () => !isFormEqual(watchedValues ?? form.getFieldsValue(), initialValuesRef.current),
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
      requiredMark={false}
      scrollToFirstError={{ behavior: "smooth", block: "center", focus: true }}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Form.Item
          name="firstName"
          label="First Name"
          rules={[{ required: true, message: "First name is required" }]}
        >
          <Input
            prefix={<User className="w-4 h-4 text-gray-400" />}
            placeholder="First name"
            size="large"
            className="rounded-xl"
          />
        </Form.Item>

        <Form.Item
          name="lastName"
          label="Last Name"
          rules={[{ required: true, message: "Last name is required" }]}
        >
          <Input
            prefix={<User className="w-4 h-4 text-gray-400" />}
            placeholder="Last name"
            size="large"
            className="rounded-xl"
          />
        </Form.Item>
      </div>

      <Form.Item
        name="email"
        label="Email Address"
        rules={[
          { required: true, message: "Email is required" },
          { type: "email", message: "Please enter a valid email" },
        ]}
      >
        <Input
          prefix={<Mail className="w-4 h-4 text-gray-400" />}
          placeholder="Email address"
          size="large"
          className="rounded-xl"
          disabled
        />
      </Form.Item>

      <Form.Item name="phone" label="Phone Number">
        <Input
          prefix={<Phone className="w-4 h-4 text-gray-400" />}
          placeholder="Phone number"
          size="large"
          className="rounded-xl"
        />
      </Form.Item>

      <div className="flex justify-end pt-2">
        <Tooltip title={!isDirty ? "No changes to save" : undefined}>
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
              Save Changes
            </Button>
          </span>
        </Tooltip>
      </div>
    </Form>
  );
};

export default ProfileSection;
