import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Box, Loader2, MapPin, Plus, X } from "lucide-react";

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
  useCreateNap,
  useUpdateNap,
} from "../../../../../services/requests/admin/network/naps";

/**
 * Coordinates are REQUIRED here, unlike on a customer: a NAP with no position
 * cannot be found by a technician, and the map is the reason the record exists.
 */
const coordinate = (label, limit) =>
  z
    .string()
    .min(1, `${label} is required`)
    .refine(
      (v) => !Number.isNaN(Number(v)) && Math.abs(Number(v)) <= limit,
      `${label} must be between -${limit} and ${limit}`,
    );

const schema = z.object({
  splitterId: z.string().min(1, "Select the splitter that feeds this NAP"),
  label: z.string().trim().min(1, "Label is required").max(120),
  totalPorts: z.coerce
    .number({ invalid_type_error: "Port count is required" })
    .int("Use a whole number")
    .min(1, "A NAP needs at least one port")
    .max(64, "More than 64 ports is unrealistic"),
  gpsLat: coordinate("Latitude", 90),
  gpsLng: coordinate("Longitude", 180),
  address: z.string().max(255, "Must be 255 characters or fewer"),
  notes: z.string().max(2000, "Must be 2000 characters or fewer"),
  status: z.enum(["Active", "Inactive"]),
});

const EMPTY = {
  splitterId: "",
  label: "",
  totalPorts: "8",
  gpsLat: "",
  gpsLng: "",
  address: "",
  notes: "",
  status: "Active",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const NapFormDrawer = ({ open, onClose, onSuccess, entity = null, splitterOptions = [] }) => {
  const isEditMode = !!entity;

  const createMutation = useCreateNap();
  const updateMutation = useUpdateNap();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            splitterId: entity.splitterId ?? "",
            label: entity.label ?? "",
            totalPorts: String(entity.totalPorts ?? "8"),
            gpsLat: entity.gpsLat === null || entity.gpsLat === undefined ? "" : String(entity.gpsLat),
            gpsLng: entity.gpsLng === null || entity.gpsLng === undefined ? "" : String(entity.gpsLng),
            address: entity.address ?? "",
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
    noun: "NAP",
    onClose: handleClose,
    label: "NapFormDrawer",
  });

  /**
   * Field techs paste coordinates straight out of a phone's map app, which
   * gives "14.5176, 121.0509" as one string. Splitting it here saves a step and
   * avoids the classic error of pasting the pair into the latitude box alone.
   */
  const handleLatPaste = (event) => {
    const text = event.clipboardData?.getData("text") ?? "";
    const match = text.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (!match) return;
    event.preventDefault();
    form.setValue("gpsLat", match[1], { shouldDirty: true, shouldValidate: true });
    form.setValue("gpsLng", match[2], { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (values) => {
    const payload = {
      splitterId: values.splitterId,
      label: values.label,
      totalPorts: values.totalPorts,
      gpsLat: Number(values.gpsLat),
      gpsLng: Number(values.gpsLng),
      address: values.address || null,
      notes: values.notes || null,
    };

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          napId: entity.napId,
          data: { ...payload, status: values.status },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("NAP submission error:", error);
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
        className="w-full gap-0 p-0 sm:max-w-150"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">{isEditMode ? "Edit NAP" : "Add NAP"}</SheetTitle>

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
                    <Box className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit NAP" : "Add NAP"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      The field box where subscriber drop cables terminate
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

              <SectionLabel>Box</SectionLabel>

              <FormField
                control={form.control}
                name="splitterId"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Fed from splitter {req}</FormLabel>
                    <Select value={field.value || undefined} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select a splitter" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {splitterOptions.map((s) => (
                          <SelectItem key={s.value} value={s.value}>
                            {s.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label {req}</FormLabel>
                      <div className="relative">
                        <Box
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input placeholder="e.g., NAP-01" className="h-10 pl-9" {...field} />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="totalPorts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Total ports {req}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={64} className="h-10" {...field} />
                      </FormControl>
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        Usually 8 or 16. Cannot go below the ports already in use.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-7">
                <SectionLabel>Position</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gpsLat"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Latitude {req}</FormLabel>
                        <div className="relative">
                          <MapPin
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="14.5176"
                              className="h-10 pl-9 font-mono"
                              {...field}
                              onPaste={handleLatPaste}
                            />
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
                        <FormLabel>Longitude {req}</FormLabel>
                        <div className="relative">
                          <MapPin
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input placeholder="121.0509" className="h-10 pl-9 font-mono" {...field} />
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
                  Paste a &quot;lat, lng&quot; pair into the latitude box and both fields fill in.
                </p>

                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="mt-5">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Corner of Sampaguita St and Rizal Ave"
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-7">
                <SectionLabel>Notes</SectionLabel>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Field notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Access instructions, pole number, anything a technician needs on site"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Status</SectionLabel>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NAP status {req}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full sm:w-60">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
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
                      {isEditMode ? "Update NAP" : "Add NAP"}
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

export default NapFormDrawer;
