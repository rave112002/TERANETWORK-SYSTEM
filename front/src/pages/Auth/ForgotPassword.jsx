import { App, Button, Form, Input } from "antd";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";
import AuthHeading from "../../components/AuthHeading";
import AuthLayout from "../../components/AuthLayout";
import { useForgotPassword } from "../../services/requests/account";

/**
 * Forgot-password page. Portal-aware (`portal` = "admin" | "superadmin").
 * The backend always returns 200 (no account enumeration), so on success we
 * show the same generic confirmation regardless of whether the email exists.
 */
const ForgotPassword = ({ portal = "admin" }) => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { mutate, isPending } = useForgotPassword(portal);
  const [sent, setSent] = useState(false);

  const loginPath = `/${portal}`;

  const onFinish = ({ email }) => {
    mutate(email, {
      onSuccess: () => setSent(true),
      onError: (error) =>
        message.error(
          error.response?.data?.message ||
            "Something went wrong. Please try again.",
        ),
    });
  };

  return (
    <AuthLayout portal={portal}>
      {sent ? (
        <AuthHeading
          centered
          icon={CheckCircle2}
          title="Check your email"
          subtitle="If an account exists for that address, we've sent a link to reset your password. The link expires in 30 minutes."
        />
      ) : (
        <>
          <AuthHeading
            icon={Mail}
            title="Forgot password?"
            subtitle="Enter your email and we'll send you a reset link."
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
              name="email"
              label="Email Address"
              getValueFromEvent={(e) => e.target.value.trim()}
              rules={[
                { required: true, message: "Please enter your email address" },
                {
                  type: "email",
                  message: "Please enter a valid email address",
                },
              ]}
            >
              <Input
                prefix={
                  <Mail
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                placeholder="Enter your email"
                type="email"
                autoComplete="username"
                autoFocus
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
                {isPending ? "Sending..." : "Send reset link"}
              </Button>
            </Form.Item>
          </Form>
        </>
      )}

      <div
        className="mt-7 pt-5 flex items-center justify-center"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <NavLink to={loginPath}>
          <span
            className="inline-flex items-center gap-1.5 hover:underline"
            style={{ fontSize: 13, color: "var(--color-link)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to sign in
          </span>
        </NavLink>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
