import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";
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
import { useForgotPassword } from "../../services/requests/account";

const schema = z.object({
  email: z
    .string()
    .trim()
    .min(1, "Please enter your email address")
    .email("Please enter a valid email address"),
});

/**
 * Forgot-password page. Portal-aware (`portal` = "admin" | "superadmin").
 * The backend always returns 200 (no account enumeration), so on success we
 * show the same generic confirmation regardless of whether the email exists.
 */
const ForgotPassword = ({ portal = "admin" }) => {
  const { mutate, isPending } = useForgotPassword(portal);
  const [sent, setSent] = useState(false);
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: "" },
  });

  const loginPath = `/${portal}`;

  const onSubmit = ({ email }) => {
    mutate(email, {
      onSuccess: () => setSent(true),
      onError: (error) =>
        toast.error(
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

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={isPending}
              >
                {isPending ? "Sending..." : "Send reset link"}
              </Button>
            </form>
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
