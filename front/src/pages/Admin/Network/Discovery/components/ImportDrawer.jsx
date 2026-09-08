import { useEffect, useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Import, Loader2, X } from "lucide-react";

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

import SectionLabel from "../../../../../components/SectionLabel";
import { useImportDiscoveredItem } from "../../../../../services/requests/admin/network/discovery";
import { useGetNaps } from "../../../../../services/requests/admin/network/naps";
import { decodeHTML } from "../../../../../utils/decode-html";

/**
 * Turning one discovered modem into inventory.
 *
 * ── Everything here is a suggestion until somebody confirms it ──────────────
 *
 * The fields arrive pre-filled from what the OLT reported and from a reading of
 * the free text a technician typed at installation. That text is often the only
 * record of who a modem belongs to — and it is also years old, inconsistent,
 * and sometimes wrong. So the parse fills the form and the person decides.
 *
 * The original description is shown above the form, unedited, so a bad reading
 * is visible rather than silently carried into the database.
 */

const importSchema = z.object({
  mac: z.string().max(17),
  serialNo: z.string().max(64),
  model: z.string().max(80),
  onuIndex: z.string().max(32),
  description: z.string().max(255),
  napId: z.string(),
  napPort: z.string(),
});

const ImportDrawer = ({ open, item, onClose }) => {
  const importMutation = useImportDiscoveredItem();

  const { data: napsData } = useGetNaps(
    { page: 1, pageSize: 100, status: "Active" },
    { enabled: open }
  );

  const napOptions = useMemo(
    () =>
      (napsData?.data?.naps || []).map((n) => ({
        value: n.napId,
        label: decodeHTML(n.label),
      })),
    [napsData]
  );

  const raw = item?.raw ?? {};
  const suggested = item?.suggested ?? {};

  const form = useForm({
    resolver: zodResolver(importSchema),
    defaultValues: {
      mac: "",
      serialNo: "",
      model: "",
      onuIndex: "",
      description: "",
      napId: "",
      napPort: "",
    },
  });

  useEffect(() => {
    if (!open || !item) return;
    form.reset({
      mac: raw.mac ?? "",
      serialNo: raw.serialNo ?? "",
      model: raw.model ?? "",
      onuIndex: raw.onuIndex ?? "",
      description: raw.description ?? "",
      napId: "",
      // Pre-filled from the parse, because "PORT 5" in the description is
      // usually right and retyping it four hundred times is the thing this
      // screen exists to avoid.
      napPort: suggested.port ? String(suggested.port) : "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.discoveredItemId]);

  const handleClose = () => {
    onClose();
  };

  const onSubmit = async (values) => {
    try {
      await importMutation.mutateAsync({
        discoveredItemId: item.discoveredItemId,
        overrides: {
          mac: values.mac || undefined,
          serialNo: values.serialNo || undefined,
          model: values.model || undefined,
          onuIndex: values.onuIndex || undefined,
          description: values.description || undefined,
          napId: values.napId || undefined,
          napPort: values.napPort ? Number(values.napPort) : undefined,
        },
      });
      handleClose();
    } catch {
      // onError has already said why — a duplicate MAC, most likely.
    }
  };

  const mac = form.watch("mac");
  const serialNo = form.watch("serialNo");
  // The one rule the backend will refuse on: a record with neither identifier
  // cannot be matched to a device at all. Said here rather than discovered on
  // submit.
  const hasIdentity = Boolean(mac?.trim() || serialNo?.trim());

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
        className="w-full gap-0 p-0 sm:max-w-175"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Add discovered modem</SheetTitle>

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
                    <Import className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      Add to inventory
                    </h2>
                    <p
                      className="m-0 mt-0.5 font-mono truncate"
                      style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
                    >
                      {item?.externalKey}
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

              {/* The evidence, unedited, above the form built from it. */}
              <div
                className="mb-6 px-4 py-3.5"
                style={{
                  borderRadius: 10,
                  border: "1px solid var(--color-line)",
                  background: "var(--color-surface-sunken)",
                }}
              >
                <SectionLabel>What the OLT reported</SectionLabel>
                <p
                  className="m-0 font-mono"
                  style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
                >
                  {decodeHTML(raw.description) || "(no description on the device)"}
                </p>
                <p
                  className="m-0 mt-2"
                  style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                >
                  {raw.online ? "Link is up" : "Link is down"} — imported as{" "}
                  <strong>{raw.online ? "active" : "unprovisioned"}</strong>. That comes from
                  the device and cannot be set here.
                </p>
                {suggested.name && (
                  <p
                    className="m-0 mt-2"
                    style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                  >
                    Reads as <strong>{decodeHTML(suggested.name)}</strong>
                    {suggested.nap ? `, NAP ${suggested.nap}` : ""}
                    {suggested.port ? `, port ${suggested.port}` : ""}. Check it before saving.
                  </p>
                )}
              </div>

              <SectionLabel>Identity</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <FormField
                  control={form.control}
                  name="mac"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MAC address</FormLabel>
                      <FormControl>
                        <Input className="h-10 font-mono" placeholder="30:c5:0f:d8:7f:2c" {...field} />
                      </FormControl>
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
                        <Input className="h-10 font-mono" placeholder="45V5" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {!hasIdentity && (
                <p
                  className="m-0 mb-5"
                  style={{ fontSize: 12.5, color: "var(--color-error)" }}
                >
                  A MAC or a serial number is needed — without one this modem cannot be
                  matched to a device later.
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <FormField
                  control={form.control}
                  name="model"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model</FormLabel>
                      <FormControl>
                        <Input className="h-10" placeholder="Huawei EG8145V5" {...field} />
                      </FormControl>
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
                      <FormControl>
                        <Input className="h-10 font-mono" placeholder="1/27" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <SectionLabel>Placement</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
                <FormField
                  control={form.control}
                  name="napId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NAP</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Not seated yet" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {napOptions.map((n) => (
                            <SelectItem key={n.value} value={n.value}>
                              {n.label}
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
                  name="napPort"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>NAP port</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={64}
                          className="h-10"
                          placeholder="5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <p
                className="m-0 mb-5"
                style={{ fontSize: 12, color: "var(--color-text-muted)" }}
              >
                Placement is optional. A modem can be recorded now and seated on the map
                later — better than not recording a device that demonstrably exists.
              </p>

              <SectionLabel>Description</SectionLabel>
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input className="h-10" maxLength={255} {...field} />
                    </FormControl>
                    <p
                      className="m-0 mt-1.5"
                      style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                    >
                      Kept as the device had it, so the original record survives the import.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div
              className="flex justify-end gap-3 p-6 pt-5"
              style={{
                borderTop: "1px solid var(--color-line)",
                paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
              }}
            >
              <Button type="button" variant="outline" size="lg" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" size="lg" disabled={!hasIdentity || importMutation.isPending}>
                {importMutation.isPending ? <Loader2 className="animate-spin" /> : <Import />}
                Add to inventory
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
};

export default ImportDrawer;
