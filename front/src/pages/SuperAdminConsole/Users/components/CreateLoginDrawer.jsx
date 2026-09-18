import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Mail, Phone, UserPlus, UserRound, X } from "lucide-react";

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
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

import SectionLabel from "../../../../components/SectionLabel";
import StatusToggle from "../../../../components/StatusToggle";
import { useCreateBranchUser } from "../../../../services/requests/superadmin-console/users";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../../utils/phoneFormat";
import PasswordField from "./PasswordField";
import { MIN_PASSWORD_LENGTH } from "./passwords";

/**
 * Create an Owner or Admin login on one branch. Staff logins (Billing,
 * Technician) are made by that branch's Admin portal, not here.
 */

const schema = z.object({
  role: z.enum(["Owner", "Admin"]),
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  email: z.string().trim().min(1, "Email is required").email("Please enter a valid email").max(100),
  phone: zPhone,
  password: z
    .string()
    .min(MIN_PASSWORD_LENGTH, `At least ${MIN_PASSWORD_LENGTH} characters`)
    .max(255),
});

const EMPTY = { role: "Admin", firstName: "", lastName: "", email: "", phone: "", password: "" };
const FIELDS = Object.keys(EMPTY);
const req = <span style={{ color: "var(--color-error)" }}>*</span>;
const hint = { fontSize: 12, color: "var(--color-text-muted)" };

const IconInput = ({ icon: Icon, field, ...props }) => (
  <div className="relative">
    <Icon
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
      style={{ color: "var(--color-text-muted)" }}
    />
    <FormControl>
      <Input className="h-10 pl-9" {...field} {...props} />
    </FormControl>
  </div>
);

const CreateLoginDrawer = ({ open, onClose, branch, hasOwner }) => {
  const mutation = useCreateBranchUser();
  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });

  useEffect(() => {
    if (open) form.reset({ ...EMPTY, role: hasOwner ? "Admin" : "Owner" });
  }, [open, hasOwner, form]);

  const handleClose = () => {
    if (mutation.isPending) return;
    form.reset(EMPTY);
    onClose();
  };

  const onSubmit = async (values) => {
    try {
      await mutation.mutateAsync({ branchId: branch.branchId, ...values, phone: values.phone || null });
      form.reset(EMPTY);
      onClose();
    } catch (error) {
      const body = error.response?.data;
      const fieldErrors = body?.errors?.filter((e) => FIELDS.includes(e.field)) ?? [];
      if (fieldErrors.length) {
        fieldErrors.forEach((e) => form.setError(e.field, { message: e.message }));
      } else {
        const onEmail = /email/i.test(body?.message ?? "");
        form.setError(onEmail ? "email" : "role", {
          message: body?.message || "The branch could not create the login",
        });
      }
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && handleClose()}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Add login</SheetTitle>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off" className="flex h-full flex-col">
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <UserPlus className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="m-0 font-semibold leading-tight" style={{ fontSize: 19, color: "var(--color-text-dark)" }}>
                      Add login
                    </h2>
                    <p className="m-0 mt-0.5 truncate" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                      On {branch?.name}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
                  style={{ width: 32, height: 32, borderRadius: 8, border: "1px solid var(--color-line)", color: "var(--color-text-secondary)" }}
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              <SectionLabel>Role</SectionLabel>
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="mb-6">
                    <StatusToggle
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { v: "Owner", dot: "var(--color-link)" },
                        { v: "Admin", dot: "var(--color-text-muted)" },
                      ]}
                    />
                    <p className="m-0 mt-1.5" style={hint}>
                      {hasOwner
                        ? "This branch already has an Owner, so only an Admin can be added."
                        : "The Owner runs the branch and has every permission. One per branch."}{" "}
                      Billing and Technician logins are made in the branch&apos;s own Admin portal.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SectionLabel>Person</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>First name {req}</FormLabel>
                      <IconInput icon={UserRound} field={field} placeholder="e.g., Juan" autoFocus />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Last name {req}</FormLabel>
                      <IconInput icon={UserRound} field={field} placeholder="e.g., Dela Cruz" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Email {req}</FormLabel>
                    <IconInput icon={Mail} field={field} placeholder="owner@teranetwork.ph" />
                    <p className="m-0 mt-1.5" style={hint}>They log in to the branch&apos;s Admin portal with this.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem className="mb-6">
                    <FormLabel>Phone number</FormLabel>
                    <IconInput
                      icon={Phone}
                      field={field}
                      placeholder={PHONE_PLACEHOLDER}
                      maxLength={PHONE_MAX_LENGTH}
                      onChange={(e) => field.onChange(formatPhoneOnChange(e.target.value))}
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <SectionLabel>First password</SectionLabel>
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password {req}</FormLabel>
                    <PasswordField field={field} placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`} />
                    <p className="m-0 mt-1.5" style={hint}>
                      Give it to the person privately. SuperAdmin does not keep it.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{ borderTop: "1px solid var(--color-line)", paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
            >
              <Button type="button" variant="outline" size="lg" onClick={handleClose} disabled={mutation.isPending}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={mutation.isPending}>
                {mutation.isPending ? <Loader2 className="animate-spin" /> : <UserPlus />}
                Create login
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default CreateLoginDrawer;
