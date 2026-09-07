import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { FileSignature, Info, Loader2, Plus, X } from "lucide-react";

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

import SectionLabel from "../../../../components/SectionLabel";
import { useDiscardGuard } from "../../../../hooks/useDiscardGuard";
import {
  useCreateSubscription,
  useUpdateSubscription,
} from "../../../../services/requests/admin/subscriptions";

const NO_ONU = "none";

const schema = z.object({
  customerId: z.string().min(1, "Select a subscriber"),
  planId: z.string().min(1, "Select a plan"),
  // Optional: a connection can be sold before the modem is installed. It simply
  // cannot be activated until one is attached.
  onuId: z.string(),
  notes: z.string().max(2000, "Must be 2000 characters or fewer"),
});

const EMPTY = { customerId: "", planId: "", onuId: NO_ONU, notes: "" };

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const SubscriptionFormDrawer = ({
  open,
  onClose,
  onSuccess,
  entity = null,
  customerOptions = [],
  planOptions = [],
  onuOptions = [],
}) => {
  const isEditMode = !!entity;

  const createMutation = useCreateSubscription();
  const updateMutation = useUpdateSubscription();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            customerId: entity.customerId ?? "",
            planId: entity.planId ?? "",
            onuId: entity.onuId ?? NO_ONU,
            notes: entity.notes ?? "",
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
    noun: "subscription",
    onClose: handleClose,
    label: "SubscriptionFormDrawer",
  });

  const onSubmit = async (values) => {
    const payload = {
      customerId: values.customerId,
      planId: values.planId,
      onuId: values.onuId === NO_ONU ? null : values.onuId,
      notes: values.notes || null,
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          subscriptionId: entity.subscriptionId,
          data: payload,
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("Subscription submission error:", error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveDisabled = isEditMode && !isDirty;

  // Changing the plan of a live subscription is legitimate but not neutral, so
  // the consequence is stated rather than left to be discovered on the invoice.
  const planChanged = isEditMode && form.watch("planId") !== entity?.planId;

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
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit subscription" : "New subscription"}
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
                    <FileSignature className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Subscription" : "New Subscription"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? `Currently ${entity?.status}`
                        : "Binds a subscriber to a plan and a modem"}
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

              <SectionLabel>Binding</SectionLabel>

              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Subscriber {req}</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select a subscriber" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customerOptions.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
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
                name="planId"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Plan {req}</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select a plan" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {planOptions.map((p) => (
                          <SelectItem key={p.value} value={p.value}>
                            {p.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {planChanged && (
                      <p
                        className="m-0 mt-1.5 inline-flex items-start gap-1.5"
                        style={{ fontSize: 12, color: "var(--color-warning)" }}
                      >
                        <Info className="w-3.5 h-3.5 mt-px shrink-0" />
                        The new price applies from the next billing cycle. Invoices already
                        issued are unchanged.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="onuId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Modem (ONU)</FormLabel>
                    <Select value={field.value || NO_ONU} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Not attached yet" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_ONU}>Not attached yet</SelectItem>
                        {onuOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      A subscription can be created before installation, but cannot be
                      activated without a modem.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-7">
                <SectionLabel>Notes</SectionLabel>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Installation date, special arrangements, anything billing should know"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {!isEditMode && (
                <p
                  className="m-0 mt-7 p-3"
                  style={{
                    fontSize: 12.5,
                    color: "var(--color-text-secondary)",
                    border: "1px solid var(--color-line)",
                    borderRadius: "var(--radius-card)",
                    background: "var(--color-surface-sunken)",
                  }}
                >
                  New subscriptions start <strong>pending</strong>. Activating one is a separate
                  step, and that is the date billing runs from.
                </p>
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
                      {isEditMode ? "Update Subscription" : "Create Subscription"}
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

export default SubscriptionFormDrawer;
