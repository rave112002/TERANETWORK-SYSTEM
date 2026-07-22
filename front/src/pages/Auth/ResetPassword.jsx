import { App, Button, Form, Input } from "antd";
import { CheckCircle2, Eye, EyeOff, Lock, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { NavLink, useSearchParams } from "react-router";
import PasswordStrengthIndicator from "../../components/PasswordStrengthIndicator";
import { useResetPassword } from "../../services/requests/account";
import { validationRules } from "../../utils/validation";

const PORTAL_LABEL = {
  admin: "Admin Portal",
  superadmin: "SuperAdmin Portal",
};

/**
 * Reset-password page. Reads the single-use token from the ?token= query param.
 * Portal-aware (`portal` = "admin" | "superadmin").
 */
const ResetPassword = ({ portal = "admin" }) => {
  const currentYear = new Date().getFullYear();
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
    <Lock className="w-4 h-4 mr-2" style={{ color: "var(--color-text-muted)" }} />
  );

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-10"
      style={{ background: "var(--color-canvas)" }}
    >
      <div className="w-full max-w-md">
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
          {done ? (
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
                Password reset
              </h1>
              <p
                className="m-0 mt-2 mb-6"
                style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
              >
                Your password has been updated. You can now sign in with your new
                password.
              </p>
              <NavLink to={loginPath}>
                <Button type="primary" block size="large">
                  Back to sign in
                </Button>
              </NavLink>
            </div>
          ) : !token ? (
            <div className="text-center">
              <h1
                className="m-0 font-semibold leading-tight"
                style={{ fontSize: 22, color: "var(--color-text-dark)" }}
              >
                Invalid reset link
              </h1>
              <p
                className="m-0 mt-2 mb-6"
                style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
              >
                This link is missing its reset token. Please request a new one.
              </p>
              <NavLink to={`${loginPath}/forgot-password`}>
                <Button type="primary" block size="large">
                  Request a new link
                </Button>
              </NavLink>
            </div>
          ) : (
            <>
              <div className="mb-7">
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 bg-(image:--gradient-primary)">
                  <Lock className="w-5.5 h-5.5 text-white" />
                </span>
                <h1
                  className="m-0 font-semibold leading-tight"
                  style={{
                    fontSize: 26,
                    letterSpacing: "-0.5px",
                    color: "var(--color-text-dark)",
                  }}
                >
                  Set a new password
                </h1>
                <p
                  className="m-0 mt-1"
                  style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
                >
                  Choose a strong password you don&apos;t use elsewhere.
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
                  name="password"
                  label="New password"
                  rules={[validationRules.strongPassword(8)]}
                >
                  <Input.Password
                    prefix={lockPrefix}
                    placeholder="Enter new password"
                    onChange={(e) => setNewPassword(e.target.value)}
                    iconRender={(visible) =>
                      visible ? (
                        <Eye
                          className="w-4 h-4"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                      ) : (
                        <EyeOff
                          className="w-4 h-4"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                      )
                    }
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
                  <Input.Password prefix={lockPrefix} placeholder="Confirm new password" />
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
            </>
          )}
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

export default ResetPassword;
