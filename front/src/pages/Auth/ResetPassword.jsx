import { App, Button, Form, Input } from "antd";
import { CheckCircle2, Eye, EyeOff, Lock } from "lucide-react";
import { useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import AuthHeading from "../../components/AuthHeading";
import AuthLayout from "../../components/AuthLayout";
import PasswordStrengthIndicator from "../../components/PasswordStrengthIndicator";
import { useResetPassword } from "../../services/requests/account";
import { validationRules } from "../../utils/validation";

/**
 * Reset-password page. Reads the single-use token from the ?token= query param.
 * Portal-aware (`portal` = "admin" | "superadmin").
 */
const ResetPassword = ({ portal = "admin" }) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const { mutate, isPending } = useResetPassword(portal);
  const [newPassword, setNewPassword] = useState("");
  const [done, setDone] = useState(false);

  const loginPath = `/${portal}`;

  const onFinish = ({ password }) => {
    mutate(
      { token, password },
      {
        onSuccess: () => setDone(true),
        onError: (error) =>
          message.error(
            error.response?.data?.message ||
              "This reset link is invalid or has expired.",
          ),
      },
    );
  };

  const lockPrefix = (
    <Lock
      className="w-4 h-4 mr-2"
      style={{ color: "var(--color-text-muted)" }}
    />
  );

  const eyeIcon = (visible) =>
    visible ? (
      <Eye className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
    ) : (
      <EyeOff
        className="w-4 h-4"
        style={{ color: "var(--color-text-muted)" }}
      />
    );

  if (done) {
    return (
      <AuthLayout portal={portal}>
        <AuthHeading
          centered
          icon={CheckCircle2}
          title="Password reset"
          subtitle="Your password has been updated. You can now sign in with your new password."
        />
        <NavLink to={loginPath}>
          <Button type="primary" block size="large" className="mt-6">
            Back to sign in
          </Button>
        </NavLink>
      </AuthLayout>
    );
  }

  if (!token) {
    return (
      <AuthLayout portal={portal}>
        <AuthHeading
          centered
          title="Invalid reset link"
          subtitle="This link is missing its reset token. Please request a new one."
        />
        <NavLink to={`${loginPath}/forgot-password`}>
          <Button type="primary" block size="large" className="mt-6">
            Request a new link
          </Button>
        </NavLink>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout portal={portal}>
      <AuthHeading
        icon={Lock}
        title="Set a new password"
        subtitle="Choose a strong password you don't use elsewhere."
      />

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        size="large"
        disabled={isPending}
        requiredMark={false}
      >
        <Form.Item
          name="password"
          label="New password"
          rules={[validationRules.strongPassword(8)]}
        >
          <Input.Password
            prefix={lockPrefix}
            placeholder="Enter new password"
            autoComplete="new-password"
            autoFocus
            onChange={(e) => setNewPassword(e.target.value)}
            iconRender={eyeIcon}
          />
        </Form.Item>

        <PasswordStrengthIndicator password={newPassword} />

        <Form.Item
          name="confirmPassword"
          label="Confirm new password"
          dependencies={["password"]}
          className="mt-4"
          rules={[
            { required: true, message: "Please confirm your new password" },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("password") === value) {
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
            autoComplete="new-password"
            iconRender={eyeIcon}
          />
        </Form.Item>

        <Form.Item className="mb-0">
          <Button
            type="primary"
            htmlType="submit"
            loading={isPending}
            block
            size="large"
          >
            {isPending ? "Resetting..." : "Reset password"}
          </Button>
        </Form.Item>
      </Form>

      <div
        className="mt-7 pt-5 flex items-center justify-center"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <NavLink to={loginPath}>
          <span
            className="hover:underline"
            style={{ fontSize: 13, color: "var(--color-link)" }}
          >
            Back to sign in
          </span>
        </NavLink>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
