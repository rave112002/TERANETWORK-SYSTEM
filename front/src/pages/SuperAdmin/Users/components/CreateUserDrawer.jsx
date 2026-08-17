import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AlertTriangle, Check, Copy, Loader2, Mail, Phone, Plus, UserPlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import SectionLabel from "../../../../components/SectionLabel";
import { useDiscardGuard } from "../../../../hooks/useDiscardGuard";
import { useCreateSuperAdminUser } from "../../../../services/requests/superadmin/users";
import { useGetCompanies } from "../../../../services/requests/superadmin/companies";
import { useGetBranches } from "../../../../services/requests/superadmin/branches";
import { decodeHTML } from "../../../../utils/decode-html";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../../utils/phoneFormat";

// Generate a random secure password
const generatePassword = (length = 12) => {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%&*";
  const all = uppercase + lowercase + numbers + special;

  let password = "";
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
};

const schema = z.object({
  companyId: z.string().min(1, "Please select a company"),
  branchId: z.string().min(1, "Please select a branch"),
  firstName: z.string().trim().min(1, "Required"),
  lastName: z.string().trim().min(1, "Required"),
  email: z.string().trim().min(1, "Required").email("Invalid email"),
  phone: zPhone,
});

const EMPTY = {
  companyId: "",
  branchId: "",
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

// Uppercase micro-label for the credential wells.
const WellLabel = ({ children }) => (
  <span
    className="uppercase"
    style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      color: "var(--color-text-muted)",
    }}
  >
    {children}
  </span>
);

const CreateUserDrawer = ({ open, onClose, onSuccess }) => {
  const createUserMutation = useCreateSuperAdminUser();

  const [successOpen, setSuccessOpen] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;
  const selectedCompanyId = form.watch("companyId");

  const { data: orgsData } = useGetCompanies({ pageSize: 100 });
  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.companyId,
      label: decodeHTML(org.name),
    }));
  }, [orgsData]);

  const { data: branchesData } = useGetBranches({
    companyId: selectedCompanyId,
    pageSize: 100,
  });
  const branchOptions = useMemo(() => {
    if (!branchesData?.data?.data) return [];
    return branchesData.data.data.map((branch) => ({
      value: branch.branchId,
      label: decodeHTML(branch.name),
    }));
  }, [branchesData]);

  useEffect(() => {
    if (open) {
      form.reset(EMPTY);
      setCreatedCredentials(null);
    }
  }, [open, form]);

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  // Escape / overlay click / X / Cancel all route through this.
  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty,
    isSubmitSuccessful,
    noun: "user",
    onClose: handleClose,
    label: "CreateUserDrawer",
  });

  const onSubmit = async (values) => {
    const password = generatePassword(12);
    try {
      await createUserMutation.mutateAsync({ ...values, password });
      setCreatedCredentials({
        email: values.email,
        password,
        name: `${values.firstName} ${values.lastName}`,
      });
      setSuccessOpen(true);
      markSaved(); // credentials dialog takes over — don't ask about saved changes
      form.reset(EMPTY);
    } catch (err) {
      console.error("Create user error:", err);
    }
  };

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    setCreatedCredentials(null);
    onSuccess?.();
  };

  const copyIcon = (field) =>
    copiedField === field ? (
      <Check className="w-4 h-4" style={{ color: "var(--color-success)" }} />
    ) : (
      <Copy className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
    );

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          if (!next) guardedClose();
        }}
      >
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 p-0 sm:max-w-200"
          style={{ background: "var(--color-surface)" }}
        >
          <SheetTitle className="sr-only">Create Owner Account</SheetTitle>

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
                      <UserPlus className="w-5.5 h-5.5 text-white" />
                    </span>
                    <div className="min-w-0">
                      <h2
                        className="m-0 font-semibold leading-tight"
                        style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                      >
                        Create Owner Account
                      </h2>
                      <p
                        className="m-0 mt-0.5"
                        style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                      >
                        Add an owner for a company branch
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={guardedClose}
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

                {/* Company */}
                <SectionLabel>Company</SectionLabel>
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Company {req}</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={(v) => {
                          field.onChange(v);
                          form.setValue("branchId", "");
                        }}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Select company" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {orgOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
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
                  name="branchId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Branch {req}</FormLabel>
                      <Select
                        value={field.value || undefined}
                        onValueChange={field.onChange}
                        disabled={!selectedCompanyId}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue
                              placeholder={
                                selectedCompanyId
                                  ? "Select branch"
                                  : "Select a company first"
                              }
                            />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {branchOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* User information */}
                <div className="mt-7">
                  <SectionLabel>User information</SectionLabel>
                  <div className="grid grid-cols-2 gap-3 items-start">
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First name {req}</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="First name"
                              className="h-10"
                              {...field}
                            />
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
                              placeholder="Last name"
                              className="h-10"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="mt-5">
                        <FormLabel>Email {req}</FormLabel>
                        <div className="relative">
                          <Mail
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="owner@company.com"
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
                    name="phone"
                    render={({ field }) => (
                      <FormItem className="mt-5">
                        <FormLabel>Phone</FormLabel>
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
                                field.onChange(
                                  formatPhoneOnChange(e.target.value),
                                )
                              }
                            />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <p
                    className="m-0 mt-2"
                    style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                  >
                    A secure password will be auto-generated and shown after
                    creation.
                  </p>
                </div>
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
                  onClick={guardedClose}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plus />
                  )}
                  Create Owner
                </Button>
              </div>
            </form>
          </Form>
        </SheetContent>
      </Sheet>

      {/* Success dialog — shows credentials to copy */}
      <Dialog
        open={successOpen}
        onOpenChange={(next) => {
          if (!next) handleSuccessClose();
        }}
      >
        <DialogContent className="sm:max-w-115">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <span
                className="inline-flex items-center justify-center shrink-0"
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                }}
              >
                <Check
                  className="w-4 h-4"
                  style={{ color: "var(--color-success)" }}
                />
              </span>
              Owner Account Created
            </DialogTitle>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-3">
              <p
                className="m-0"
                style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
              >
                Account for <strong>{createdCredentials.name}</strong> has been
                created. Please copy and share the credentials below.
              </p>

              {/* Email */}
              <div
                className="p-4 space-y-1"
                style={{
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <WellLabel>Email</WellLabel>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-mono truncate"
                    style={{ fontSize: 13, color: "var(--color-text-dark)" }}
                  >
                    {createdCredentials.email}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy email"
                    onClick={() => handleCopy(createdCredentials.email, "email")}
                  >
                    {copyIcon("email")}
                  </Button>
                </div>
              </div>

              {/* Password */}
              <div
                className="p-4 space-y-1"
                style={{
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  borderRadius: "var(--radius-card)",
                }}
              >
                <WellLabel>Password</WellLabel>
                <div className="flex items-center justify-between gap-2">
                  <span
                    className="font-mono truncate"
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "var(--color-text-dark)",
                    }}
                  >
                    {createdCredentials.password}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Copy password"
                    onClick={() =>
                      handleCopy(createdCredentials.password, "password")
                    }
                  >
                    {copyIcon("password")}
                  </Button>
                </div>
              </div>

              {/* Copy All */}
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() =>
                  handleCopy(
                    `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`,
                    "all",
                  )
                }
              >
                {copiedField === "all" ? (
                  <Check
                    className="w-4 h-4"
                    style={{ color: "var(--color-success)" }}
                  />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
                {copiedField === "all" ? "Copied!" : "Copy All Credentials"}
              </Button>

              <div
                className="flex items-start gap-2 p-3"
                style={{
                  border: "1px solid var(--color-line)",
                  borderRadius: "var(--radius-control)",
                }}
              >
                <AlertTriangle
                  className="w-3.5 h-3.5 shrink-0 mt-0.5"
                  style={{ color: "var(--color-warning)" }}
                />
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  This password will not be shown again. Make sure to copy it
                  now.
                </span>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button size="lg" onClick={handleSuccessClose}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CreateUserDrawer;
