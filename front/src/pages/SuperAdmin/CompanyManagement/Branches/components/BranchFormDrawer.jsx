import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Building2, CreditCard, Loader2, Mail, MapPin, Phone, Plus, X } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import SectionLabel from "../../../../../components/SectionLabel";
import { useDiscardGuard } from "../../../../../hooks/useDiscardGuard";
import {
  useCreateBranch,
  useUpdateBranch,
} from "../../../../../services/requests/superadmin/branches";
import { useGetCompanies } from "../../../../../services/requests/superadmin/companies";
import { useGetSystemInfo } from "../../../../../services/requests/superadmin/system";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../../../utils/phoneFormat";

const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Suspended", label: "Suspended" },
];

/**
 * "Follow the company default" needs a value a <Select> can hold, because Radix
 * treats an empty string as "nothing selected" and shows the placeholder
 * instead of the choice. It is translated back to "" on the way out, which the
 * API stores as NULL.
 */
const DEFAULT_PROVIDER = "__default__";

/** Names for the slugs. Anything unrecognised shows its slug rather than
 *  disappearing — a branch pointed at a gateway this build does not have is
 *  exactly what somebody needs to see. */
const PROVIDER_LABELS = {
  hitpay: "HitPay",
  mock: "Mock gateway (development)",
};

const optionalEmail = z
  .string()
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Please enter a valid email",
  );

const EMPTY = {
  companyId: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  paymentProvider: DEFAULT_PROVIDER,
  status: "Active",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const BranchFormDrawer = ({ open, onClose, onSuccess, entity }) => {
  const isEditMode = !!entity;
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();

  // Which adapters this build actually has, read from the server rather than
  // listed here. A hard-coded dropdown lags the code by a release, and the
  // symptom is a gateway you cannot select on the day it ships.
  const { data: systemData } = useGetSystemInfo();
  const gateway = systemData?.data?.paymentGateway;
  const providerOptions = useMemo(() => {
    const available = gateway?.available ?? [];
    return available.map((slug) => ({
      value: slug,
      label: PROVIDER_LABELS[slug] ?? slug,
    }));
  }, [gateway]);

  const { data: orgsData } = useGetCompanies({ pageSize: 100 });
  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.companyId,
      label: org.name,
    }));
  }, [orgsData]);

  const schema = useMemo(
    () =>
      z.object({
        companyId: z.string().min(1, "Please select a company"),
        name: z
          .string()
          .trim()
          .min(1, "Branch name is required")
          .max(100, "Must be 100 characters or fewer"),
        email: optionalEmail,
        phone: zPhone,
        address: z.string().max(255, "Must be 255 characters or fewer"),
        paymentProvider: z.string(),
        ...(isEditMode
          ? { status: z.enum(["Active", "Inactive", "Suspended"]) }
          : {}),
      }),
    [isEditMode],
  );

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            companyId: entity.companyId ?? "",
            name: entity.name ?? "",
            email: entity.email ?? "",
            phone: entity.phone ?? "",
            address: entity.address ?? "",
            paymentProvider: entity.paymentProvider || DEFAULT_PROVIDER,
            status: entity.status ?? "Active",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveDisabled = isEditMode && !isDirty;

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  // Escape / overlay click / X / Cancel all route through this.
  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty,
    isSubmitSuccessful,
    noun: "branch",
    onClose: handleClose,
    label: "BranchFormDrawer",
  });

  const onSubmit = async (values) => {
    // The sentinel exists only so a <Select> can hold "follow the company
    // default"; the API says that with an empty string, and stores it as NULL.
    const provider =
      values.paymentProvider === DEFAULT_PROVIDER ? "" : values.paymentProvider;

    try {
      if (isEditMode) {
        // The PUT endpoint does not accept companyId — a branch can't be moved.
        await updateMutation.mutateAsync({
          branchId: entity.branchId,
          branchData: {
            name: values.name,
            email: values.email || null,
            phone: values.phone || null,
            address: values.address || null,
            paymentProvider: provider,
            status: values.status,
          },
        });
      } else {
        await createMutation.mutateAsync({
          companyId: values.companyId,
          name: values.name,
          email: values.email || null,
          phone: values.phone || null,
          address: values.address || null,
          paymentProvider: provider,
        });
      }
      markSaved(); // the parent closes us next — don't ask about saved changes
      onSuccess?.();
    } catch (err) {
      console.error("Branch form error:", err);
    }
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
          {isEditMode ? "Edit Branch" : "Create New Branch"}
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
                    <MapPin className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Branch" : "Create New Branch"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? "Update branch information"
                        : "Add a branch to a company"}
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
                  <FormItem>
                    <FormLabel>Company {req}</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={isEditMode}
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
                    {isEditMode && (
                      <p
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        A branch can&apos;t be moved to a different company.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Branch details */}
              <div className="mt-7">
                <SectionLabel>Branch details</SectionLabel>
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Branch name {req}</FormLabel>
                      <div className="relative">
                        <Building2
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input
                            placeholder="e.g., Main Branch, Downtown Office"
                            className="h-10 pl-9"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-3 items-start">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <div className="relative">
                          <Mail
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="branch@company.com"
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
                      <FormItem>
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
                </div>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="mt-5">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          maxLength={255}
                          placeholder="Full branch address"
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <div className="flex items-center justify-between gap-3">
                        <FormMessage />
                        <span
                          className="ml-auto shrink-0 text-xs"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          {field.value?.length || 0}/255
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-7">
                <SectionLabel>Payments</SectionLabel>
                <FormField
                  control={form.control}
                  name="paymentProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Collect through</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={DEFAULT_PROVIDER}>
                            {/* A colon rather than parentheses: the mock's own
                                label already carries a bracketed word, and
                                "Company default (Mock gateway (development))"
                                reads as a typo. */}
                            Company default
                            {gateway?.provider
                              ? `: ${PROVIDER_LABELS[gateway.provider] ?? gateway.provider}`
                              : ""}
                          </SelectItem>
                          {providerOptions.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* Says the one thing that is not obvious from the field:
                          picking a gateway here does not give this branch its
                          own merchant account. */}
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        <CreditCard
                          className="inline w-3.5 h-3.5 mr-1 -mt-0.5"
                          strokeWidth={1.9}
                        />
                        Branches on the same gateway share one merchant account. Its
                        credentials live in the server environment, not here.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Status — update-only */}
              {isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Access status</SectionLabel>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {STATUS_OPTIONS.map((o) => (
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
                      ) : isEditMode ? null : (
                        <Plus />
                      )}
                      {isEditMode ? "Update Branch" : "Create Branch"}
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

export default BranchFormDrawer;
