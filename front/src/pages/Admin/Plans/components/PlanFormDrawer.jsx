import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowDownToLine, ArrowUpFromLine, Gauge, Loader2, Plus, X } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import SectionLabel from "../../../../components/SectionLabel";
import StatusToggle from "../../../../components/StatusToggle";
import { useDiscardGuard } from "../../../../hooks/useDiscardGuard";
import { useCreatePlan, useUpdatePlan } from "../../../../services/requests/admin/plans";

/**
 * Required-ness mirrors `plans` in back/database/schema.sql: name, speeds and
 * monthlyPrice are NOT NULL; description is TEXT NULL and the two fees default
 * to 0, so those validate shape rather than presence.
 */
const planSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Plan name is required")
    .max(100, "Plan name must not exceed 100 characters"),
  description: z.string().max(1000, "Description must not exceed 1000 characters"),
  downMbps: z.coerce
    .number({ invalid_type_error: "Download speed is required" })
    .int("Use a whole number of Mbps")
    .positive("Download speed must be greater than 0")
    .max(100000, "That speed looks unrealistic"),
  upMbps: z.coerce
    .number({ invalid_type_error: "Upload speed is required" })
    .int("Use a whole number of Mbps")
    .positive("Upload speed must be greater than 0")
    .max(100000, "That speed looks unrealistic"),
  monthlyPrice: z.coerce
    .number({ invalid_type_error: "Monthly price is required" })
    .min(0, "Price cannot be negative")
    .max(9999999999.99, "Price is too large"),
  installFee: z.coerce
    .number({ invalid_type_error: "Installation fee must be a number" })
    .min(0, "Fee cannot be negative")
    .max(9999999999.99, "Fee is too large"),
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = {
  name: "",
  description: "",
  downMbps: "",
  upMbps: "",
  monthlyPrice: "",
  installFee: "0",
  status: "Active",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const PlanFormDrawer = ({ open, onClose, onSuccess, entity = null }) => {
  const isEditMode = !!entity;

  const createMutation = useCreatePlan();
  const updateMutation = useUpdatePlan();

  const form = useForm({ resolver: zodResolver(planSchema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            name: entity.name ?? "",
            description: entity.description ?? "",
            downMbps: String(entity.downMbps ?? ""),
            upMbps: String(entity.upMbps ?? ""),
            monthlyPrice: String(entity.monthlyPrice ?? ""),
            installFee: String(entity.installFee ?? "0"),
            status: entity.status === "Inactive" ? "Inactive" : "Active",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const handleClose = () => {
    form.reset(EMPTY);
    onClose();
  };

  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty,
    isSubmitSuccessful,
    noun: "plan",
    onClose: handleClose,
    label: "PlanFormDrawer",
  });

  const onSubmit = async (values) => {
    // Mapped explicitly — `reconnectionFee` is deliberately not sent: it is
    // zero by client decision and the column keeps its default.
    const payload = {
      name: values.name,
      description: values.description || null,
      downMbps: values.downMbps,
      upMbps: values.upMbps,
      monthlyPrice: values.monthlyPrice,
      installFee: values.installFee,
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          planId: entity.planId,
          planData: { ...payload, status: values.status },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("Plan submission error:", error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveDisabled = isEditMode && !isDirty;

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
          {isEditMode ? "Edit Plan" : "Create New Plan"}
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
                    <Gauge className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Plan" : "Create New Plan"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? "Changes apply from the next billing cycle"
                        : "Define a speed tier and its monthly price"}
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

              <SectionLabel>Plan details</SectionLabel>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Plan name {req}</FormLabel>
                    <div className="relative">
                      <Gauge
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input
                          placeholder="e.g., Fiber 50Mbps"
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
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="What the subscriber gets on this tier"
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <div className="flex items-start justify-between gap-3">
                      <FormMessage />
                      <span
                        className="shrink-0"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        {field.value?.length ?? 0}/1000
                      </span>
                    </div>
                  </FormItem>
                )}
              />

              <div className="mt-7">
                <SectionLabel>Speed</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="downMbps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Download (Mbps) {req}</FormLabel>
                        <div className="relative">
                          <ArrowDownToLine
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              placeholder="50"
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
                    name="upMbps"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Upload (Mbps) {req}</FormLabel>
                        <div className="relative">
                          <ArrowUpFromLine
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              placeholder="20"
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
              </div>

              <div className="mt-7">
                <SectionLabel>Pricing</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="monthlyPrice"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Monthly price (PHP) {req}</FormLabel>
                        <div className="relative">
                          <span
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}
                          >
                            ₱
                          </span>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              placeholder="4999.00"
                              className="h-10 pl-8"
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
                    name="installFee"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Installation fee (PHP)</FormLabel>
                        <div className="relative">
                          <span
                            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}
                          >
                            ₱
                          </span>
                          <FormControl>
                            <Input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              min={0}
                              placeholder="0.00"
                              className="h-10 pl-8"
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          Charged once, on the subscriber&apos;s first invoice.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Availability</SectionLabel>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status {req}</FormLabel>
                        <StatusToggle value={field.value} onChange={field.onChange} />
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          Inactive plans stay on existing subscriptions but cannot be
                          chosen for new ones.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>

            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{
                borderTop: "1px solid var(--color-line)",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <Button type="button" variant="outline" size="lg" onClick={guardedClose}>
                Cancel
              </Button>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="inline-flex">
                    <Button type="submit" size="lg" disabled={saveDisabled || isPending}>
                      {isPending ? <Loader2 className="animate-spin" /> : <Plus />}
                      {isEditMode ? "Update Plan" : "Create Plan"}
                    </Button>
                  </span>
                </TooltipTrigger>
                {saveDisabled && <TooltipContent>No changes to save yet</TooltipContent>}
              </Tooltip>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default PlanFormDrawer;
