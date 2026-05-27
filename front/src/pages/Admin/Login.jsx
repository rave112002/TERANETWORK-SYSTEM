import { App, Button, Form, Input, Typography } from "antd";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { useEffect } from "react";
import { NavLink } from "react-router";
import { useLoginAdminAuth } from "../../services/requests/admin/auth";

const { Text } = Typography;

const Login = () => {
  const currentYear = new Date().getFullYear();
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { mutate, isPending } = useLoginAdminAuth();

  useEffect(() => {
    form.setFieldsValue({
      // email: "admin@demo.com",
      // password: "admin123",
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
    <div className="flex min-h-screen items-center justify-center px-4 relative overflow-hidden bg-linear-to-br from-primary-pale via-white to-secondary-pale">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-linear-to-r from-primary-pale/40 to-secondary-pale/40 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-linear-to-r from-secondary-pale/30 to-primary-pale/30 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
        <div
          className="absolute top-2/3 left-1/3 w-72 h-72 bg-linear-to-r from-primary-pale/20 to-secondary-pale/20 rounded-full blur-2xl animate-pulse"
          style={{ animationDelay: "2s" }}
        ></div>
      </div>

      {/* Admin Badge */}
      <div className="absolute top-8 right-8 z-20">
        <div className="flex items-center gap-2 px-4 py-2 backdrop-blur-md bg-white/80 border border-primary-pale rounded-2xl shadow-lg">
          <Shield className="text-primary-color w-5 h-5" />
          <Text className="text-primary-dark text-sm font-semibold">
            Admin Portal
          </Text>
        </div>
      </div>

      {/* Main login container */}
      <div className="relative z-10 w-full max-w-md">
        <div className="relative">
          {/* Glassmorphism card */}
          <div className="relative backdrop-blur-xl bg-white/95 border border-primary-pale rounded-2xl shadow-2xl p-8 transition-all duration-300">
            {/* Welcome section */}
            <div className="text-center mb-8">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 shadow-lg"
                style={{ background: "var(--gradient-primary)" }}
              >
                <Shield className="w-8 h-8 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-text-dark mb-2">
                Welcome Back
              </h1>
              <p style={{ color: "var(--color-text-secondary)" }}>
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
              className="space-y-6"
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
                label={
                  <label className="text-text-dark font-medium">
                    Email Address
                  </label>
                }
              >
                <Input
                  prefix={<Mail className="w-4 h-4 text-primary-color" />}
                  placeholder="Enter your email"
                  className="rounded-xl border-primary-pale hover:border-primary-color focus:border-primary-color transition-colors duration-200 py-3 bg-white/90"
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
                label={
                  <label className="text-text-dark font-medium">Password</label>
                }
              >
                <Input.Password
                  prefix={<Lock className="w-4 h-4 text-primary-color" />}
                  placeholder="Enter your password"
                  iconRender={(visible) =>
                    visible ? (
                      <Eye className="w-4 h-4 text-primary-color" />
                    ) : (
                      <EyeOff className="w-4 h-4 text-primary-color" />
                    )
                  }
                  className="rounded-xl border-primary-pale hover:border-primary-color focus:border-primary-color transition-colors duration-200 py-3 bg-white/90"
                />
              </Form.Item>

              {/* Forgot password link */}
              <div className="flex justify-end">
                <NavLink to="/forgot-password">
                  <span className="text-text-secondary text-sm hover:text-primary-color transition-colors duration-200 hover:underline">
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
                  className="w-full h-12 rounded-xl font-semibold text-base transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] text-white border-0"
                  style={{
                    background: "var(--gradient-primary)",
                    boxShadow:
                      "0 4px 20px color-mix(in srgb, var(--color-primary-color) 40%, transparent)",
                  }}
                >
                  {isPending ? "Signing In..." : "Sign In"}
                </Button>
              </Form.Item>
            </Form>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-primary-pale"></div>
              </div>
            </div>

            {/* Security info */}
            <div className="flex items-center justify-center gap-2 text-text-secondary text-sm">
              <Shield className="w-4 h-4 text-primary-color shrink-0" />
              <span>Secured admin access</span>
            </div>
          </div>
        </div>

        {/* Footer text */}
        <div className="text-center mt-8 text-text-secondary text-sm font-medium px-2">
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
