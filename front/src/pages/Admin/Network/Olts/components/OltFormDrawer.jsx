import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { KeyRound, Loader2, Plus, Router, Server, User, X } from "lucide-react";

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
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import PasswordInput from "../../../../../components/PasswordInput";
import SectionLabel from "../../../../../components/SectionLabel";
import { useDiscardGuard } from "../../../../../hooks/useDiscardGuard";
import {
  useCreateOlt,
  useUpdateOlt,
} from "../../../../../services/requests/admin/network/olts";

const VENDORS = [
  { value: "hsgq", label: "HSGQ" },
  { value: "huawei", label: "Huawei" },
  { value: "zte", label: "ZTE" },
  { value: "fiberhome", label: "Fiberhome" },
  { value: "vsol", label: "VSOL" },
  { value: "bdcom", label: "BDCOM" },
  { value: "mock", label: "Mock (testing)" },
  { value: "other", label: "Other" },
];

const PROTOCOLS = [
  { value: "telnet", label: "Telnet", port: 23 },
  { value: "ssh", label: "SSH", port: 22 },
  { value: "snmp", label: "SNMP", port: 161 },
  { value: "tr069", label: "TR-069", port: 7547 },
];

const schema = z.object({
  name: z.string().trim().min(1, "Device name is required").max(100),
  vendor: z.string().min(1, "Vendor is required"),
  ponTechnology: z.enum(["epon", "gpon"]),
  model: z.string().max(80, "Must be 80 characters or fewer"),
  host: z.string().trim().min(1, "Management host is required").max(190),
  port: z.coerce
    .number({ invalid_type_error: "Port is required" })
    .int("Port must be a whole number")
    .min(1, "Port must be between 1 and 65535")
    .max(65535, "Port must be between 1 and 65535"),
  protocol: z.string().min(1, "Protocol is required"),
  site: z.string().max(120, "Must be 120 characters or fewer"),
  maxConcurrentSessions: z.coerce
    .number({ invalid_type_error: "Required" })
    .int()
    .min(1, "At least one session")
    .max(16, "16 is the practical maximum"),
  notes: z.string().max(2000, "Must be 2000 characters or fewer"),
  // Credentials are validated as a pair below: supplying one without the other
  // is a half-configured device, which fails at connect time rather than here.
  username: z.string().max(64),
  password: z.string().max(128),
  status: z.enum(["Active", "Maintenance", "Retired"]),
});

const EMPTY = {
  name: "",
  vendor: "hsgq",
  ponTechnology: "epon",
  model: "",
  host: "",
  port: "23",
  protocol: "telnet",
  site: "",
  maxConcurrentSessions: "1",
  notes: "",
  username: "",
  password: "",
  status: "Active",
};

const req = <span style={{ color: "var(--color-error)" }}>*</span>;

const OltFormDrawer = ({ open, onClose, onSuccess, entity = null }) => {
  const isEditMode = !!entity;
  const [credentialError, setCredentialError] = useState("");

  const createMutation = useCreateOlt();
  const updateMutation = useUpdateOlt();

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty, isSubmitSuccessful },
  } = form;

  useEffect(() => {
    if (!open) return;
    form.reset(
      entity
        ? {
            name: entity.name ?? "",
            vendor: entity.vendor ?? "hsgq",
            ponTechnology: entity.ponTechnology === "gpon" ? "gpon" : "epon",
            model: entity.model ?? "",
            host: entity.host ?? "",
            port: String(entity.port ?? "23"),
            protocol: entity.protocol ?? "telnet",
            site: entity.site ?? "",
            maxConcurrentSessions: String(entity.maxConcurrentSessions ?? "1"),
            notes: entity.notes ?? "",
            // Never pre-filled: the API does not return credentials, and it
            // must not look as though a blank field means "no password set".
            username: "",
            password: "",
            status: ["Active", "Maintenance", "Retired"].includes(entity.status)
              ? entity.status
              : "Active",
          }
        : EMPTY,
    );
  }, [open, entity, form]);

  const handleClose = () => {
    form.reset(EMPTY);
    setCredentialError("");
    onClose();
  };

  const { guardedClose, markSaved } = useDiscardGuard({
    open,
    isDirty,
    isSubmitSuccessful,
    noun: "OLT",
    onClose: handleClose,
    label: "OltFormDrawer",
  });

  /** Fill in the conventional port when the protocol changes and nothing was typed. */
  const handleProtocolChange = (value) => {
    form.setValue("protocol", value, { shouldDirty: true });
    const preset = PROTOCOLS.find((p) => p.value === value);
    const current = form.getValues("port");
    const isPreset = PROTOCOLS.some((p) => String(p.port) === String(current));
    if (preset && (!current || isPreset)) {
      form.setValue("port", String(preset.port), { shouldDirty: true });
    }
  };

  const onSubmit = async (values) => {
    const username = values.username.trim();
    const password = values.password;

    if (Boolean(username) !== Boolean(password)) {
      setCredentialError("Enter both a username and a password, or leave both blank.");
      return;
    }
    setCredentialError("");

    const payload = {
      name: values.name,
      vendor: values.vendor,
      ponTechnology: values.ponTechnology,
      model: values.model || null,
      host: values.host,
      port: values.port,
      protocol: values.protocol,
      site: values.site || null,
      maxConcurrentSessions: values.maxConcurrentSessions,
      notes: values.notes || null,
    };

    // Omitted entirely when blank — on edit that tells the API to keep whatever
    // is stored, which is the only way an un-displayable secret can survive.
    if (username && password) {
      payload.credentials = { username, password };
    }

    try {
      if (isEditMode) {
        await updateMutation.mutateAsync({
          oltId: entity.oltId,
          data: { ...payload, status: values.status },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      markSaved();
      onSuccess?.();
    } catch (error) {
      console.error("OLT submission error:", error);
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
        <SheetTitle className="sr-only">{isEditMode ? "Edit OLT" : "Add OLT"}</SheetTitle>

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
                    <Server className="w-5.5 h-5.5 text-white" />
                  </span>
                  <div className="min-w-0">
                    <h2
                      className="m-0 font-semibold leading-tight"
                      style={{ fontSize: 19, color: "var(--color-text-dark)" }}
                    >
                      {isEditMode ? "Edit OLT" : "Add OLT"}
                    </h2>
                    <p
                      className="m-0 mt-0.5"
                      style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
                    >
                      {isEditMode
                        ? "Update the device record and its management details"
                        : "Register a head-end device on the management network"}
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

              <SectionLabel>Device</SectionLabel>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="mb-5">
                    <FormLabel>Device name {req}</FormLabel>
                    <div className="relative">
                      <Router
                        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                      <FormControl>
                        <Input placeholder="e.g., HSGQ XE04I — Bicutan POP" className="h-10 pl-9" {...field} />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="vendor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vendor {req}</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue placeholder="Select vendor" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VENDORS.map((v) => (
                            <SelectItem key={v.value} value={v.value}>
                              {v.label}
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
                  name="ponTechnology"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PON technology {req}</FormLabel>
                      <Select value={field.value || undefined} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="h-10 w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="epon">EPON</SelectItem>
                          <SelectItem value="gpon">GPON</SelectItem>
                        </SelectContent>
                      </Select>
                      <p
                        className="m-0 mt-1.5"
                        style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                      >
                        EPON identifies modems by MAC.
                      </p>
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
                        <Input placeholder="e.g., XE04I" className="h-10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="mt-7">
                <SectionLabel>Management access</SectionLabel>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="host"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Host {req}</FormLabel>
                        <FormControl>
                          <Input placeholder="192.168.88.10" className="h-10 font-mono" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="port"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Port {req}</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={65535} className="h-10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5">
                  <FormField
                    control={form.control}
                    name="protocol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Protocol {req}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={handleProtocolChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Select protocol" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {PROTOCOLS.map((p) => (
                              <SelectItem key={p.value} value={p.value}>
                                {p.label}
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
                    name="maxConcurrentSessions"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max sessions {req}</FormLabel>
                        <FormControl>
                          <Input type="number" min={1} max={16} className="h-10" {...field} />
                        </FormControl>
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          The HSGQ XE04I tolerates one.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="site"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Bicutan POP" className="h-10" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="mt-7">
                <SectionLabel>Credentials</SectionLabel>
                <p
                  className="m-0 mb-4"
                  style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                >
                  {isEditMode
                    ? entity?.hasCredentials
                      ? "Credentials are stored and encrypted. They cannot be displayed — fill these in only to replace them."
                      : "No credentials stored yet. This device cannot be reached until they are set."
                    : "Stored encrypted, and never readable through the API afterwards. Optional — the device can be inventoried first."}
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <div className="relative">
                          <User
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="root"
                              autoComplete="off"
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
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {isEditMode && entity?.hasCredentials ? "New password" : "Password"}
                        </FormLabel>
                        <FormControl>
                          <PasswordInput
                            autoComplete="new-password"
                            placeholder={
                              isEditMode && entity?.hasCredentials ? "Leave blank to keep" : "Device password"
                            }
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {credentialError && (
                  <p className="m-0 mt-2" style={{ fontSize: 12.5, color: "var(--color-error)" }}>
                    {credentialError}
                  </p>
                )}
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
                        <Textarea placeholder="Firmware quirks, rack position, anything worth knowing" rows={3} {...field} />
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
                        <FormLabel>Device status {req}</FormLabel>
                        <Select value={field.value || undefined} onValueChange={field.onChange}>
                          <FormControl>
                            <SelectTrigger className="h-10 w-full sm:w-60">
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Active">Active</SelectItem>
                            <SelectItem value="Maintenance">Maintenance</SelectItem>
                            <SelectItem value="Retired">Retired</SelectItem>
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
                      {isPending ? <Loader2 className="animate-spin" /> : isEditMode ? <KeyRound /> : <Plus />}
                      {isEditMode ? "Update OLT" : "Add OLT"}
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

export default OltFormDrawer;
