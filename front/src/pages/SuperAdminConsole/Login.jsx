import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { UserRound } from "lucide-react";

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
import { useSuperAdminLogin } from "../../services/requests/superadmin-console/auth";

/**
 * Login to the central SuperAdmin app.
 *
 * A username, not an email: these logins live only in superadmin-server's
 * database on this PC and are made with `npm run user`. There is no
 * "forgot password" — whoever runs this PC resets it with the same command.
 */
const schema = z.object({
  username: z.string().trim().min(1, "Please enter your username"),
  password: z.string().min(1, "Please enter your password"),
});

const Login = () => {
  const { mutate, isPending } = useSuperAdminLogin();
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  });

  const onSubmit = (values) => {
    mutate(values, {
      onError: (error) =>
        toast.error(error.response?.data?.message || "Unable to sign in. Is superadmin-server running?"),
    });
  };

  return (
    <AuthLayout portal="superadmin">
      <AuthHeading
        title="Welcome back"
        subtitle="Sign in to manage every TERANETWORK branch."
      />

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username</FormLabel>
                <div className="relative">
                  <UserRound
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <FormControl>
                    <Input
                      autoComplete="username"
                      autoFocus
                      placeholder="Enter your username"
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

          <Button type="submit" size="lg" className="w-full" disabled={isPending}>
            {isPending ? "Signing In..." : "Sign In"}
          </Button>
        </form>
      </Form>
    </AuthLayout>
  );
};

export default Login;
