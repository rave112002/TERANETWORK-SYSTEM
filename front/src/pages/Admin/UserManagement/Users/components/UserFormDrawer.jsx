import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, Mail, Phone, Plus, Shield, Users, X } from "lucide-react";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import PasswordStrengthIndicator from "../../../../../components/PasswordStrengthIndicator";
import SectionLabel from "../../../../../components/SectionLabel";
import StatusToggle from "../../../../../components/StatusToggle";
import { getRoles } from "../../../../../services/api/admin/roles";
import {
  useCreateUser,
  useUpdateUser,
} from "../../../../../services/requests/admin/user";
import { useAdminAuthStore } from "../../../../../store/authStore";
import { zStrongPassword } from "../../../../../utils/validation";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../../../utils/phoneFormat";

const baseShape = {
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Enter a valid email address"),
  phone: zPhone,
  roleId: z.string().min(1, "Please select a role"),
  status: z.enum(["Active", "Inactive"]),
};

const EMPTY = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  roleId: "",
  status: "Active",
  password: "",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const UserFormDrawer = ({ open, onClose, onSuccess, entity = null }) => {
  const { userData } = useAdminAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const isEditMode = !!entity;

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const schema = useMemo(
    () =>
      z.object(
        isEditMode ? baseShape : { ...baseShape, password: zStrongPassword(8) },
      ),
    [isEditMode],
  );

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty },
  } = form;

  const password = form.watch("password");

  const { data: rolesData } = useQuery({
    queryKey: ["roles", { status: "Active" }],
    queryFn: () => getRoles({ status: "Active", pageSize: 100 }),
  });
  const roles = rolesData?.data?.roles || [];

  useEffect(() => {
    if (!open) return;
    setShowPassword(false);
    form.reset(
      entity
        ? {
            firstName: entity.firstName ?? "",
            lastName: entity.lastName ?? "",
            email: entity.email ?? "",
            phone: entity.phone ?? "",
            roleId: entity.roleId ?? "",
            status: entity.status ?? "Active",
            password: "",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const isPending =
    createUserMutation.isPending || updateUserMutation.isPending;
  const saveDisabled = isEditMode && !isDirty;

  const handleClose = () => {
    form.reset(EMPTY);
    setShowPassword(false);
    onClose();
  };

  const onSubmit = async (values) => {
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      email: values.email,
      phone: values.phone,
      roleId: values.roleId,
      status: values.status,
      companyId: userData?.companyId,
    };
    try {
      if (isEditMode) {
        await updateUserMutation.mutateAsync({
          userId: entity.accountId,
          userData: payload,
        });
      } else {
        await createUserMutation.mutateAsync({
          ...payload,
          password: values.password,
        });
      }
      onSuccess?.();
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) handleClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-200"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit User" : "Create New User"}
        </SheetTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <Users className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit User" : "Create New User"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? "Update user account and permissions"
                        : "Add a new team member to your company"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close"
                  className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid var(--color-line)",
                    color: "var(--color-text-secondary)",
                  }}
                >
                  <X className="w-4.5 h-4.5" />
                </button>
              </div>

              {/* Personal information */}
              <SectionLabel>Personal information</SectionLabel>
              <div className="grid grid-cols-2 gap-4 items-start">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name {req}</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan" className="h-10" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input
                          placeholder="Dela Cruz"
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Contact information */}
              <div className="mt-7">
                <SectionLabel>Contact information</SectionLabel>
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
                            disabled={isEditMode}
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

              {/* Role & access */}
              <div className="mt-7">
                <SectionLabel>Role &amp; access</SectionLabel>
                <FormField
                  control={form.control}
                  name="roleId"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Role {req}</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {roles.map((role) => (
                            <SelectItem key={role.roleId} value={role.roleId}>
                              <Shield className="w-4 h-4" />
                              {role.roleName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status {req}</FormLabel>
                      <StatusToggle
                        value={field.value}
                        onChange={field.onChange}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Security — create mode only */}
              {!isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Security</SectionLabel>
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temporary password {req}</FormLabel>
                        <div className="relative">
                          <Lock
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              type={showPassword ? "text" : "password"}
                              placeholder="Enter temporary password"
                              className="h-10 pl-9 pr-9"
                              {...field}
                            />
                          </FormControl>
                          <button
                            type="button"
                            onClick={() => setShowPassword((s) => !s)}
                            aria-label={
                              showPassword ? "Hide password" : "Show password"
                            }
                            className="icon-btn absolute right-2 top-1/2 h-6 w-6 -translate-y-1/2"
                          >
                            {showPassword ? (
                              <EyeOff className="w-4 h-4" />
                            ) : (
                              <Eye className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <PasswordStrengthIndicator password={password} />

                  <p
                    className="mt-3"
                    style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                  >
                    User will be prompted to change this on first login.
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{
                borderTop: "1px solid var(--color-line)",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleClose}
              >
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button
                      type="submit"
                      size="lg"
                      disabled={saveDisabled || isPending}
                    >
                      {isPending ? (
                        <Loader2 className="animate-spin" />
                      ) : (
                        <Plus />
                      )}
                      {isEditMode ? "Update User" : "Create User"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {saveDisabled && (
                  <TooltipContent>No changes to save yet</TooltipContent>
                )}
              </Tooltip>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default UserFormDrawer;
