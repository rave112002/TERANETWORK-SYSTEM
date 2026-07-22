import { App, Button, Form, Input } from "antd";
import { ArrowLeft, CheckCircle2, Mail, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NavLink } from "react-router";
import { useForgotPassword } from "../../services/requests/account";

const PORTAL_LABEL = {
  admin: "Admin Portal",
  superadmin: "SuperAdmin Portal",
};

/**
 * Forgot-password page. Portal-aware (`portal` = "admin" | "superadmin").
 * The backend always returns 200 (no account enumeration), so on success we
 * show the same generic confirmation regardless of whether the email exists.
 */
const ForgotPassword = ({ portal = "admin" }) => {
  const currentYear = new Date().getFullYear();
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
          error.response?.data?.message || "Something went wrong. Please try again.",
        ),
    });
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--color-canvas)" }}
    >
      <div className="w-full max-w-md">
        {/* Portal label */}
        <div className="flex items-center justify-center gap-2 mb-5">
          <ShieldCheck
            className="w-3.5 h-3.5"
            style={{ color: "var(--color-text-muted)" }}
          />
          <span
            className="uppercase"
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: "0.08em",
              color: "var(--color-text-muted)",
            }}
          >
            {PORTAL_LABEL[portal]}
          </span>
        </div>

        <div
          className="p-8"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          {sent ? (
            <div className="text-center">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 bg-(image:--gradient-primary)">
                <CheckCircle2 className="w-5.5 h-5.5 text-white" />
              </span>
              <h1
                className="m-0 font-semibold leading-tight"
                style={{
                  fontSize: 22,
                  letterSpacing: "-0.4px",
                  color: "var(--color-text-dark)",
                }}
              >
                Check your email
              </h1>
              <p
                className="m-0 mt-2"
                style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
              >
                If an account exists for that address, we&apos;ve sent a link to
                reset your password. The link expires in 30 minutes.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 bg-(image:--gradient-primary)">
                  <Mail className="w-5.5 h-5.5 text-white" />
                </span>
                <h1
                  className="m-0 font-semibold leading-tight"
                  style={{
                    fontSize: 26,
                    letterSpacing: "-0.5px",
                    color: "var(--color-text-dark)",
                  }}
                >
                  Forgot password?
                </h1>
                <p
                  className="m-0 mt-1"
                  style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
                >
                  Enter your email and we&apos;ll send you a reset link.
                </p>
              </div>

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
                    { type: "email", message: "Please enter a valid email address" },
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
        </div>

        <div
          className="text-center mt-6 px-2"
          style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
        >
          <span>
            {`© ${currentYear} ${import.meta.env.VITE_APP_NAME || "Your Company"}.`}
            <br />
            All rights reserved.
          </span>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
