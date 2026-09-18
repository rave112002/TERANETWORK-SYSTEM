import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { Loader2, Mail, Phone, User } from "lucide-react";

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SectionLabel from "../../../../components/SectionLabel";
import { useAdminAuthStore } from "../../../../store/authStore";
import { useUpdateProfile } from "../../../../services/requests/account";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../../utils/phoneFormat";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string(),
  phone: zPhone,
});

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const ProfileSection = ({ portal = "admin" }) => {
  // Admin portal only: the in-branch SuperAdmin portal was removed (D10).
  const userData = useAdminAuthStore((s) => s.userData);
  const setUserData = useAdminAuthStore.getState().setUserData;

  const { mutate, isPending } = useUpdateProfile(portal);

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { firstName: "", lastName: "", email: "", phone: "" },
  });
  const {
    formState: { isDirty },
  } = form;

  useEffect(() => {
    if (userData) {
      form.reset({
        firstName: userData.firstName ?? "",
        lastName: userData.lastName ?? "",
        email: userData.email ?? "",
        phone: userData.phone ?? "",
      });
    }
  }, [userData, form]);

  const onSubmit = (values) => {
    mutate(
      {
        firstName: values.firstName,
        lastName: values.lastName,
        phone: values.phone || null,
      },
      {
        onSuccess: (response) => {
          const updated = response?.data?.user;
          if (updated) setUserData(updated);
          toast.success("Profile updated successfully");
          form.reset(values); // new baseline
        },
        onError: (error) =>
          toast.error(
            error.response?.data?.message || "Failed to update profile",
          ),
      },
    );
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off">
        {/* Personal details */}
        <SectionLabel>Personal details</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4 items-start">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First name {req}</FormLabel>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <FormControl>
                    <Input placeholder="e.g., Juan" className="h-10 pl-9" {...field} />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last name {req}</FormLabel>
                <div className="relative">
                  <User
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <FormControl>
                    <Input
                      placeholder="e.g., Dela Cruz"
                      className="h-10 pl-9"
                      {...field}
                    />
                  </FormControl>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Contact */}
        <div className="mt-7">
          <SectionLabel>Contact</SectionLabel>
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem className="mb-5">
                <FormLabel>Email address {req}</FormLabel>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <FormControl>
                    <Input
                      placeholder="juan@example.com"
                      className="h-10 pl-9"
                      disabled
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
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                  <FormControl>
                    <Input
                      placeholder={PHONE_PLACEHOLDER}
                      className="h-10 pl-9"
                      maxLength={PHONE_MAX_LENGTH}
                      {...field}
                      onChange={(e) =>
                        field.onChange(formatPhoneOnChange(e.target.value))
                      }
                    />
                  </FormControl>
                </div>
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
                  Save Changes
                </Button>
              </span>
            </TooltipTrigger>
            {!isDirty && (
              <TooltipContent>No changes to save yet</TooltipContent>
            )}
          </Tooltip>
        </div>
      </form>
    </Form>
  );
};

export default ProfileSection;
