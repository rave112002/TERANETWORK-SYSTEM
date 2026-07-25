import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import PasswordInput from "../../../../components/PasswordInput";
import PasswordStrengthIndicator from "../../../../components/PasswordStrengthIndicator";
import SectionLabel from "../../../../components/SectionLabel";
import { zStrongPassword } from "../../../../utils/validation";
import { useChangePassword } from "../../../../services/requests/account";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: zStrongPassword(8),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

const EMPTY = { currentPassword: "", newPassword: "", confirmPassword: "" };

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const PasswordSection = ({ portal = "admin" }) => {
  const { mutate, isPending } = useChangePassword(portal);
  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty },
  } = form;
  const newPassword = form.watch("newPassword");

  const onSubmit = (values) => {
    mutate(
      {
        currentPassword: values.currentPassword,
        newPassword: values.newPassword,
      },
      {
        onSuccess: () => {
          toast.success("Password changed successfully");
          form.reset(EMPTY);
        },
        onError: (error) =>
          toast.error(
            error.response?.data?.message || "Failed to change password",
          ),
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off">
        {/* Current password */}
        <SectionLabel>Current password</SectionLabel>
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Current password {req}</FormLabel>
              <FormControl>
                <PasswordInput
                  autoComplete="current-password"
                  placeholder="Enter current password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* New password */}
        <div className="mt-7">
          <SectionLabel>New password</SectionLabel>
          <FormField
            control={form.control}
            name="newPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel>New password {req}</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Enter new password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <PasswordStrengthIndicator password={newPassword} />

          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem className="mt-4">
                <FormLabel>Confirm new password {req}</FormLabel>
                <FormControl>
                  <PasswordInput
                    autoComplete="new-password"
                    placeholder="Confirm new password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Footer */}
        <div
          className="mt-7 pt-5 flex justify-end"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="submit"
                  size="lg"
                  disabled={!isDirty || isPending}
                >
                  {isPending && <Loader2 className="animate-spin" />}
                  Change Password
                </Button>
              </span>
            </TooltipTrigger>
            {!isDirty && (
              <TooltipContent>
                Enter your new password to continue
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </form>
    </Form>
  );
};

export default PasswordSection;
