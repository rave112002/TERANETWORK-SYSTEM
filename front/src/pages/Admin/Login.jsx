import { App, Button, Form, Input } from "antd";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { useEffect } from "react";
import { NavLink } from "react-router";
import { useLoginAdminAuth } from "../../services/requests/admin/auth";

const Login = () => {
  const currentYear = new Date().getFullYear();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { mutate, isPending } = useLoginAdminAuth();

  useEffect(() => {
    form.setFieldsValue({
      email: "admin@demo.com",
      password: "admin123",
    });
  }, [form]);

  const onFinish = (values) => {
    mutate(values, {
      onSuccess: () => {
        form.resetFields();
      },
      onError: (error) => {
        message.error(error.response?.data?.message);
      },
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
          <Shield
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
            Admin Portal
          </span>
        </div>

        {/* Login card */}
        <div
          className="p-8"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          {/* Welcome section */}
          <div className="mb-7">
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl mb-4 bg-(image:--gradient-primary)">
              <Shield className="w-5.5 h-5.5 text-white" />
            </span>
            <h1
              className="m-0 font-semibold leading-tight"
              style={{
                fontSize: 26,
                letterSpacing: "-0.5px",
                color: "var(--color-text-dark)",
              }}
            >
              Welcome Back
            </h1>
            <p
              className="m-0 mt-1"
              style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
            >
              Sign in to your admin account to continue
            </p>
          </div>

          {/* Login form */}
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            size="large"
            disabled={isPending}
            requiredMark={false}
          >
            {/* Email field */}
            <Form.Item
              name="email"
              rules={[
                {
                  required: true,
                  message: "Please enter your email address",
                },
                {
                  type: "email",
                  message: "Please enter a valid email address",
                },
              ]}
              getValueFromEvent={(e) => e.target.value.trim()}
              label="Email Address"
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

            {/* Password field */}
            <Form.Item
              name="password"
              rules={[
                {
                  required: true,
                  message: "Please enter your password",
                },
              ]}
              label="Password"
            >
              <Input.Password
                prefix={
                  <Lock
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                placeholder="Enter your password"
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

            {/* Forgot password link */}
            <div className="flex justify-end mb-5">
              <NavLink to="/forgot-password">
                <span
                  className="hover:underline"
                  style={{ fontSize: 13, color: "var(--color-link)" }}
                >
                  Forgot your password?
                </span>
              </NavLink>
            </div>

            {/* Login button */}
            <Form.Item className="mb-0">
              <Button
                type="primary"
                htmlType="submit"
                loading={isPending}
                block
                size="large"
              >
                {isPending ? "Signing In..." : "Sign In"}
              </Button>
            </Form.Item>
          </Form>

          {/* Security info */}
          <div
            className="mt-7 pt-5 flex items-center justify-center gap-2"
            style={{ borderTop: "1px solid var(--color-line)" }}
          >
            <Shield
              className="w-3.5 h-3.5 shrink-0"
              style={{ color: "var(--color-success)" }}
            />
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Secured admin access
            </span>
          </div>
        </div>

        {/* Footer text */}
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

export default Login;
