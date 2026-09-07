import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { NavLink } from "react-router";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import AuthHeading from "../../components/AuthHeading";
import AuthLayout from "../../components/AuthLayout";
import PasswordInput from "../../components/PasswordInput";
import { useLoginSuperAdminAuth } from "../../services/requests/superadmin/auth";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address"),
  password: z.string().min(1, "Please enter your password"),
});

const Login = () => {
  const { mutate, isPending } = useLoginSuperAdminAuth();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (values) => {
    mutate(values, {
      onSuccess: () => form.reset(),
      onError: (error) =>
        toast.error(
          error.response?.data?.message ||
            "Unable to sign in. Please try again.",
        ),
    });
  };

  return (
    <AuthLayout portal="superadmin">
      <AuthHeading
        title="Welcome back"
        subtitle="Sign in with your superadmin credentials."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email Address</FormLabel>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="username"
                      autoFocus
                      placeholder="Enter your email"
                      className="h-10 pl-9"
                      {...field}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end">
            <NavLink to="/superadmin/forgot-password">
              <span
                className="hover:underline"
                style={{ fontSize: 13, color: "var(--color-link)" }}
              >
                Forgot your password?
              </span>
            </NavLink>
          </div>

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isPending}
          >
            {isPending ? "Signing In..." : "Sign In"}
          </Button>
        </form>
      </Form>

    </AuthLayout>
  );
};

export default Login;
