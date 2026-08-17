import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Mail, Phone, Plus, Shield, X } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import DatePicker from "@/components/DatePicker";
import PasswordInput from "@/components/PasswordInput";
import SectionLabel from "@/components/SectionLabel";
import StatusToggle from "@/components/StatusToggle";
import { useDiscardGuard } from "@/hooks/useDiscardGuard";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "@/utils/phoneFormat";
import { zStrongPassword } from "@/utils/validation";

/**
 * A no-op version of the module form drawer, here purely so the landing-page
 * gallery can preview the pattern: the form owns its Sheet, react-hook-form +
 * zod drive validation, and submitting only fires a toast — no API call.
 */
const memberSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Full name must be at least 3 characters")
    .max(50, "Full name must be at most 50 characters"),
  email: z.string().trim().email("Enter a valid email address"),
  phone: zPhone,
  roleId: z.string().min(1, "Select a role"),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Select a start date"),
  password: zStrongPassword(8),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .refine(
      (v) => v === "" || v.length >= 10,
      "Description must be at least 10 characters",
    ),
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = {
  fullName: "",
  email: "",
  phone: "",
  roleId: "",
  startDate: "",
  password: "",
  description: "",
  status: "Active",
};

const ROLES = [
  { roleId: "admin", roleName: "Administrator" },
  { roleId: "manager", roleName: "Branch Manager" },
  { roleId: "staff", roleName: "Staff" },
];

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const DemoFormDrawer = ({ open, onClose, onSuccess, entity }) => {
  const isEditMode = !!entity;
  const [isPending, setIsPending] = useState(false);

  const form = useForm({
    resolver: zodResolver(memberSchema),
    defaultValues: EMPTY,
  });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;
  const saveDisabled = isEditMode && !isDirty;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            fullName: entity.fullName ?? "",
            email: entity.email ?? "",
            phone: entity.phone ?? "",
            roleId: entity.roleId ?? "",
            startDate: entity.startDate ?? "",
            password: "",
            description: entity.description ?? "",
            status: entity.status ?? "Active",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  // Type something, then hit Escape or click the overlay to see the guard.
  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty,
    isSubmitSuccessful,
    noun: "member",
    onClose: handleClose,
    label: "DemoFormDrawer",
  });

  const onSubmit = (values) => {
    // Preview only — a real drawer would call its React Query mutation here.
    setIsPending(true);
    setTimeout(() => {
      setIsPending(false);
      toast.success(`Validated "${values.fullName}" — nothing was saved`);
      markSaved();
      form.reset(EMPTY);
      onSuccess?.();
    }, 800);
  };

  return (
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
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit Member" : "Create New Member"}
        </SheetTitle>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            autoComplete="off"
            className="flex h-full flex-col"
          >
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between gap-3 mb-7">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
                    <Shield className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Member" : "Create New Member"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{
                        fontSize: 13,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      Preview of the shared form pattern — nothing is saved.
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

              <SectionLabel>Member details</SectionLabel>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Full name {req}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Maria Santos"
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
                  name="email"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Email {req}</FormLabel>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input
                            placeholder="name@company.com"
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
                    <FormItem className="mb-5">
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
                          {ROLES.map((r) => (
                            <SelectItem key={r.roleId} value={r.roleId}>
                              {r.roleName}
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
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Start date {req}</FormLabel>
                      <FormControl>
                        <DatePicker className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={3}
                        placeholder="Optional — at least 10 characters once you start typing"
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-start justify-between gap-3">
                      <FormMessage />
                      <span
                        className="shrink-0"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        {field.value.length}/500
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              <div className="mt-7">
                <SectionLabel>Access</SectionLabel>

                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Password {req}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder="At least 8 characters"
                          {...field}
                        />
                      </FormControl>
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
            </div>

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
                      {isEditMode ? "Update Member" : "Create Member"}
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

export default DemoFormDrawer;
