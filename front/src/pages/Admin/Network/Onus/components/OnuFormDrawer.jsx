import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Hash, Loader2, Plus, Router, X } from "lucide-react";

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
  useCreateOnu,
  useUpdateOnu,
} from "../../../../../services/requests/admin/network/onus";

const NO_NAP = "none";

const schema = z
  .object({
    serialNo: z.string().max(64, "Must be 64 characters or fewer"),
    // Three spellings arrive from devices; the API normalises whichever is sent.
    mac: z
      .string()
      .max(20)
      .refine(
        (v) => v === "" || /^[0-9a-f]{12}$/i.test(v.replace(/[:.-]/g, "")),
        "MAC must be 12 hex digits, e.g. 30:c5:0f:d8:7f:2c",
      ),
    model: z.string().max(80, "Must be 80 characters or fewer"),
    napId: z.string(),
    napPort: z.string(),
    onuIndex: z
      .string()
      .max(32)
      .refine((v) => v === "" || /^\d+\/\d+$/.test(v), "Use 'pon/onu-id', e.g. 1/27"),
    description: z.string().max(255, "Must be 255 characters or fewer"),
    notes: z.string().max(2000, "Must be 2000 characters or fewer"),
    recordStatus: z.enum(["Active", "Inactive"]),
  })
  // A record with neither identifier can never be matched to a real device.
  .refine((data) => Boolean(data.serialNo.trim()) || Boolean(data.mac.trim()), {
    message: "Provide a serial number or a MAC address",
    path: ["mac"],
  })
  // A port number without a box means nothing.
  .refine((data) => !data.napPort || (data.napId && data.napId !== NO_NAP), {
    message: "Choose a NAP before assigning a port",
    path: ["napPort"],
  });

const EMPTY = {
  serialNo: "",
  mac: "",
  model: "",
  napId: NO_NAP,
  napPort: "",
  onuIndex: "",
  description: "",
  notes: "",
  recordStatus: "Active",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const OnuFormDrawer = ({ open, onClose, onSuccess, entity = null, napOptions = [] }) => {
  const isEditMode = !!entity;

  const createMutation = useCreateOnu();
  const updateMutation = useUpdateOnu();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            serialNo: entity.serialNo ?? "",
            mac: entity.mac ?? "",
            model: entity.model ?? "",
            napId: entity.napId ?? NO_NAP,
            napPort: entity.napPort ? String(entity.napPort) : "",
            onuIndex: entity.onuIndex ?? "",
            description: entity.description ?? "",
            notes: entity.notes ?? "",
            recordStatus: entity.recordStatus === "Inactive" ? "Inactive" : "Active",
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
    noun: "ONU",
    onClose: handleClose,
    label: "OnuFormDrawer",
  });

  const onSubmit = async (values) => {
    const napId = values.napId === NO_NAP ? null : values.napId;

    const payload = {
      serialNo: values.serialNo.trim() || null,
      mac: values.mac.trim() || null,
      model: values.model || null,
      napId,
      napPort: napId && values.napPort ? Number(values.napPort) : null,
      onuIndex: values.onuIndex || null,
      description: values.description || null,
      notes: values.notes || null,
    };

    try {
      if (isEditMode) {
        // provisioningState is deliberately absent: it belongs to the
        // provisioning worker and only moves after a confirmed device response.
        await updateMutation.mutateAsync({
          onuId: entity.onuId,
          data: { ...payload, recordStatus: values.recordStatus },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("ONU submission error:", error);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const saveDisabled = isEditMode && !isDirty;

  const selectedNapId = form.watch("napId");
  const selectedNap = napOptions.find((n) => n.value === selectedNapId);

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
        <SheetTitle className="sr-only">{isEditMode ? "Edit ONU" : "Add ONU"}</SheetTitle>

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
                    <Router className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit ONU" : "Add ONU"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      Subscriber modem — inventory only; service state is set by the worker
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

              <SectionLabel>Identity</SectionLabel>
              <p
                className="m-0 mb-4"
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                At least one of MAC or serial is required. On EPON the MAC is the
                device&apos;s identity and the key that matches it to a PPPoE session.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="mac"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MAC address {req}</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="30:c5:0f:d8:7f:2c"
                          className="h-10 font-mono"
                          {...field}
                        />
                      </FormControl>
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        Colons, dashes or the dotted form all work.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="serialNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Serial number</FormLabel>
                      <FormControl>
                        <Input placeholder="HWTC12345678" className="h-10 font-mono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input placeholder="EG8145V5" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-7">
                <SectionLabel>Placement</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="napId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NAP</FormLabel>
                        <Select value={field.value || NO_NAP} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Not seated" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value={NO_NAP}>Not seated</SelectItem>
                            {napOptions.map((n) => (
                              <SelectItem key={n.value} value={n.value}>
                                {n.label} ({n.usedPorts}/{n.totalPorts})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          The OLT and PON port are worked out from this.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="napPort"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>NAP port</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={selectedNap?.totalPorts || 64}
                            placeholder="5"
                            className="h-10"
                            disabled={!selectedNapId || selectedNapId === NO_NAP}
                            {...field}
                          />
                        </FormControl>
                        {selectedNap && (
                          <p
                            className="m-0 mt-1.5"
                            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                          >
                            1–{selectedNap.totalPorts}; {selectedNap.usedPorts} already in use.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="onuIndex"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ONU index</FormLabel>
                        <div className="relative">
                          <Hash
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input placeholder="1/27" className="h-10 pl-9 font-mono" {...field} />
                          </FormControl>
                        </div>
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          As the OLT numbers it: pon/onu-id.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="mt-7">
                <SectionLabel>Labels</SectionLabel>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Device description</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Jacqueline-Rebancos PON 2 NAP 1 PORT 5"
                          className="h-10"
                          {...field}
                        />
                      </FormControl>
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        The free text written on the device itself. Device discovery reads it.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Internal notes</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Anything staff should know about this unit" rows={3} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Inventory record</SectionLabel>
                  <FormField
                    control={form.control}
                    name="recordStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Record status {req}</FormLabel>
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
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          Whether the inventory record is in use — not the modem&apos;s service
                          state, which only the provisioning worker can change.
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
                      {isEditMode ? "Update ONU" : "Add ONU"}
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

export default OnuFormDrawer;
