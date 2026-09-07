import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Wifi, X } from "lucide-react";

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

import SectionLabel from "../../../../../components/SectionLabel";
import { useDiscardGuard } from "../../../../../hooks/useDiscardGuard";
import {
  useCreatePonPort,
  useUpdatePonPort,
} from "../../../../../services/requests/admin/network/pon-ports";

const schema = z.object({
  oltId: z.string().min(1, "Select the OLT this port belongs to"),
  // Vendor formats vary: '1' on the HSGQ, '0/1/3' on a Huawei.
  portIndex: z
    .string()
    .trim()
    .min(1, "Port index is required")
    .max(32)
    .refine(
      (v) => v.split("/").every((part) => /^[0-9]{1,8}$/.test(part)),
      "Use digits separated by slashes, e.g. 1 or 0/1/3",
    ),
  capacity: z.coerce
    .number({ invalid_type_error: "Capacity is required" })
    .int("Capacity must be a whole number")
    .min(1, "At least 1")
    .max(256, "256 is the practical maximum for a PON"),
  description: z.string().max(190, "Must be 190 characters or fewer"),
  status: z.enum(["Active", "Down", "Reserved"]),
});

const EMPTY = {
  oltId: "",
  portIndex: "",
  capacity: "64",
  description: "",
  status: "Active",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const PonPortFormDrawer = ({ open, onClose, onSuccess, entity = null, oltOptions = [] }) => {
  const isEditMode = !!entity;

  const createMutation = useCreatePonPort();
  const updateMutation = useUpdatePonPort();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            oltId: entity.oltId ?? "",
            portIndex: entity.portIndex ?? "",
            capacity: String(entity.capacity ?? "64"),
            description: entity.description ?? "",
            status: ["Active", "Down", "Reserved"].includes(entity.status)
              ? entity.status
              : "Active",
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
    noun: "PON port",
    onClose: handleClose,
    label: "PonPortFormDrawer",
  });

  const onSubmit = async (values) => {
    const payload = {
      portIndex: values.portIndex,
      capacity: values.capacity,
      description: values.description || null,
    };

    try {
      if (isEditMode) {
        // oltId is deliberately not sent: moving a port to another OLT would
        // silently re-parent everything beneath it.
        await updateMutation.mutateAsync({
          ponPortId: entity.ponPortId,
          data: { ...payload, status: values.status },
        });
      } else {
        await createMutation.mutateAsync({ ...payload, oltId: values.oltId });
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("PON port submission error:", error);
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
        <SheetTitle className="sr-only">
          {isEditMode ? "Edit PON port" : "Add PON port"}
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
                    <Wifi className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit PON Port" : "Add PON Port"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? "The parent OLT cannot be changed"
                        : "A port feeds one tree of subscribers"}
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

              <SectionLabel>Port</SectionLabel>

              <FormField
                control={form.control}
                name="oltId"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>OLT {req}</FormLabel>
                    <Select
                      value={field.value || undefined}
                      onValueChange={field.onChange}
                      disabled={isEditMode}
                    >
                      <FormControl>
                        <SelectTrigger className="h-10 w-full">
                          <SelectValue placeholder="Select an OLT" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {oltOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {isEditMode && (
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        Fixed after creation — moving a port would re-parent every
                        splitter, NAP and ONU below it.
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="portIndex"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Port index {req}</FormLabel>
                      <FormControl>
                        <Input placeholder="1" className="h-10 font-mono" {...field} />
                      </FormControl>
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        As the device names it: <code>1</code> on HSGQ, <code>0/1/3</code> on Huawei.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity {req}</FormLabel>
                      <FormControl>
                        <Input type="number" min={1} max={256} className="h-10" {...field} />
                      </FormControl>
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        Maximum ONUs on this PON. Usually 64 or 128.
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem className="mt-5">
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Serves Sampaguita and Ilang-Ilang" className="h-10" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isEditMode && (
                <div className="mt-7">
                  <SectionLabel>Status</SectionLabel>
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port status {req}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full sm:w-60">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Down">Down</SelectItem>
                            <SelectItem value="Reserved">Reserved</SelectItem>
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
                      {isEditMode ? "Update Port" : "Add Port"}
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

export default PonPortFormDrawer;
