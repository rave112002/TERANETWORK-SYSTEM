import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  CreditCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  User,
  X,
} from "lucide-react";

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
import {
  useCreateCustomer,
  useUpdateCustomer,
} from "../../../../services/requests/admin/customers";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneOnChange,
  zPhone,
} from "../../../../utils/phoneFormat";

/**
 * Required-ness mirrors `customers` in back/database/schema.sql.
 *
 * `email` is required and that is a business rule, not a form preference:
 * invoices are delivered by email only, so a subscriber without one cannot be
 * billed. Everything else is NULLable and validates shape, not presence.
 */
const coordinate = (label, limit) =>
  z
    .string()
    .refine(
      (v) => v === "" || (!Number.isNaN(Number(v)) && Math.abs(Number(v)) <= limit),
      `${label} must be between -${limit} and ${limit}`,
    );

const customerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Subscriber name is required")
    .max(150, "Name must not exceed 150 characters"),
  email: z
    .string()
    .trim()
    .min(1, "Email is required")
    .email("Please enter a valid email")
    .max(100, "Email must not exceed 100 characters"),
  phone: zPhone,
  address: z.string().max(1000, "Address must not exceed 1000 characters"),
  gpsLat: coordinate("Latitude", 90),
  gpsLng: coordinate("Longitude", 180),
  idType: z.string().max(40, "Must not exceed 40 characters"),
  idNumber: z.string().max(64, "Must not exceed 64 characters"),
  notes: z.string().max(2000, "Notes must not exceed 2000 characters"),
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = {
  name: "",
  email: "",
  phone: "",
  address: "",
  gpsLat: "",
  gpsLng: "",
  idType: "",
  idNumber: "",
  notes: "",
  status: "Active",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const CustomerFormDrawer = ({ open, onClose, onSuccess, entity = null }) => {
  const isEditMode = !!entity;

  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const form = useForm({ resolver: zodResolver(customerSchema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            name: entity.name ?? "",
            email: entity.email ?? "",
            phone: entity.phone ?? "",
            address: entity.address ?? "",
            gpsLat: entity.gpsLat === null || entity.gpsLat === undefined ? "" : String(entity.gpsLat),
            gpsLng: entity.gpsLng === null || entity.gpsLng === undefined ? "" : String(entity.gpsLng),
            idType: entity.idType ?? "",
            idNumber: entity.idNumber ?? "",
            notes: entity.notes ?? "",
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
    noun: "subscriber",
    onClose: handleClose,
    label: "CustomerFormDrawer",
  });

  const onSubmit = async (values) => {
    // Empty optionals go as null, which is what the API expects for "no value".
    const payload = {
      name: values.name,
      email: values.email,
      phone: values.phone || null,
      address: values.address || null,
      gpsLat: values.gpsLat === "" ? null : Number(values.gpsLat),
      gpsLng: values.gpsLng === "" ? null : Number(values.gpsLng),
      idType: values.idType || null,
      idNumber: values.idNumber || null,
      notes: values.notes || null,
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          customerId: entity.customerId,
          customerData: { ...payload, status: values.status },
        });
      } else {
        // branchId is omitted on purpose — the API files new subscribers in the
        // creating user's home branch.
        await createMutation.mutateAsync(payload);
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("Customer submission error:", error);
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
          {isEditMode ? "Edit Subscriber" : "Create New Subscriber"}
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
                    <User className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit Subscriber" : "New Subscriber"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? `Account ${entity?.accountNo ?? ""}`
                        : "An account number is assigned automatically"}
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

              <SectionLabel>Subscriber</SectionLabel>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Full name {req}</FormLabel>
                    <div className="relative">
                      <User
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input
                          placeholder="e.g., Juan dela Cruz"
                          className="h-10 pl-9"
                          {...field}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email {req}</FormLabel>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input
                            placeholder="juan@example.com"
                            className="h-10 pl-9"
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        Invoices are sent here — required.
                      </p>
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
                            onChange={(e) => field.onChange(formatPhoneOnChange(e.target.value))}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-7">
                <SectionLabel>Service location</SectionLabel>
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Street, barangay, city"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gpsLat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitude</FormLabel>
                        <div className="relative">
                          <MapPin
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input placeholder="14.5176" className="h-10 pl-9" {...field} />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="gpsLng"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longitude</FormLabel>
                        <div className="relative">
                          <MapPin
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input placeholder="121.0509" className="h-10 pl-9" {...field} />
                          </FormControl>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <p
                  className="m-0 mt-2"
                  style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                >
                  Coordinates plot the subscriber on the network map. Optional.
                </p>
              </div>

              <div className="mt-7">
                <SectionLabel>Identification</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="idType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID type</FormLabel>
                        <div className="relative">
                          <CreditCard
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="e.g., Driver's License"
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
                    name="idNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ID number</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., N01-23-456789" className="h-10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

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
                          placeholder="Anything staff should know about this account"
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
                          {field.value?.length ?? 0}/2000
                        </span>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              {isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Account status</SectionLabel>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status {req}</FormLabel>
                        <StatusToggle value={field.value} onChange={field.onChange} />
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
                      {isEditMode ? "Update Subscriber" : "Create Subscriber"}
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

export default CustomerFormDrawer;
