import { App, Button, Form, Input } from "antd";
import { Eye, EyeOff, Lock, Mail, Shield } from "lucide-react";
import { NavLink } from "react-router";
import AuthHeading from "../../components/AuthHeading";
import AuthLayout from "../../components/AuthLayout";
import { useLoginAdminAuth } from "../../services/requests/admin/auth";

const Login = () => {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const { mutate, isPending } = useLoginAdminAuth();

  const onFinish = (values) => {
    mutate(values, {
      onSuccess: () => form.resetFields(),
      // Fall back to a generic message: a network failure or a 500 with no body
      // leaves `data.message` undefined, which renders an empty toast.
      onError: (error) =>
        message.error(
          error.response?.data?.message ||
            "Unable to sign in. Please try again.",
        ),
    });
  };

  return (
    <AuthLayout portal="admin">
      <AuthHeading
        icon={Shield}
        title="Welcome Back"
        subtitle="Sign in to your admin account to continue"
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
            type="email"
            autoComplete="username"
            autoFocus
          />
        </Form.Item>

        <Form.Item
          name="password"
          label="Password"
          rules={[{ required: true, message: "Please enter your password" }]}
        >
          <Input.Password
            prefix={
              <Lock
                className="w-4 h-4 mr-2"
                style={{ color: "var(--color-text-muted)" }}
              />
            }
            placeholder="Enter your password"
            autoComplete="current-password"
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

        <div className="flex justify-end mb-5">
          <NavLink to="/admin/forgot-password">
            <span
              className="hover:underline"
              style={{ fontSize: 13, color: "var(--color-link)" }}
            >
              Forgot your password?
            </span>
          </NavLink>
        </div>

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

      <div
        className="mt-7 pt-5 flex items-center justify-center gap-2"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <Shield
          className="w-3.5 h-3.5 shrink-0"
          style={{ color: "var(--color-text-muted)" }}
        />
        <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
          Secured admin access
        </span>
      </div>
    </AuthLayout>
  );
};

export default Login;
