import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  Building2,
  Calendar,
  CircleAlert,
  Clock,
  Link2,
  Loader2,
  Mail,
  Smartphone,
  UserRound,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import Spinner from "../../../components/Spinner";
import PageHeader from "../../../components/PageHeader";
import SectionLabel from "../../../components/SectionLabel";
import StatusToggle from "../../../components/StatusToggle";
import { usePermissions } from "../../../hooks/usePermissions";
import {
  useGetSettings,
  useUpdateSettings,
} from "../../../services/requests/admin/settings";
import {
  formatPhoneOnChange,
  PHONE_PLACEHOLDER,
  zPhone,
} from "../../../utils/phoneFormat";

const DATE_FORMAT_OPTIONS = [
  { value: "MMM D, YYYY", label: "MMM D, YYYY  (Jan 5, 2025)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD  (2025-01-05)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY  (05/01/2025)" },
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY  (01/05/2025)" },
];

const WEEK_START_OPTIONS = [
  { v: "Monday", dot: "var(--color-text-muted)" },
  { v: "Sunday", dot: "var(--color-text-muted)" },
];

const schema = z.object({
  companyDisplayName: z.string().max(100, "Must be 100 characters or fewer"),
  supportEmail: z
    .string()
    .refine(
      (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      "Please enter a valid email",
    ),
  dateFormat: z.string(),
  timezone: z.string(),
  weekStartsOn: z.string(),
  gcashNumber: zPhone,
  gcashAccountName: z.string().max(100, "Must be 100 characters or fewer"),
  facebookPageUrl: z
    .string()
    .max(255, "Must be 255 characters or fewer")
    .refine(
      (v) => v === "" || /^https?:\/\/\S+$/i.test(v.trim()),
      "Enter the full link, starting with https://",
    ),
  invoiceTerms: z.string().max(1500, "Must be 1,500 characters or fewer"),
});

const EMPTY = {
  companyDisplayName: "",
  supportEmail: "",
  dateFormat: "MMM D, YYYY",
  timezone: "",
  weekStartsOn: "Monday",
  gcashNumber: "",
  gcashAccountName: "",
  facebookPageUrl: "",
  invoiceTerms: "",
};

/** Stored values over the blanks. A cleared setting comes back as null. */
const toFormValues = (settings) =>
  Object.fromEntries(
    Object.entries({ ...EMPTY, ...settings }).map(([k, v]) => [k, v ?? ""]),
  );

/**
 * What customers will read on invoices and billing emails. Mirrors
 * back/server/src/lib/payments/instructions.js closely enough to check the
 * wording; the backend version is the one that is sent.
 */
const PaymentPreview = ({ control }) => {
  const [number, name, page] = useWatch({
    control,
    name: ["gcashNumber", "gcashAccountName", "facebookPageUrl"],
  });
  const lines = number
    ? [
        `1. Send PHP 1,399.00 by GCash to ${number}${name ? ` (${name})` : ""}.`,
        "Paying from Maya or a bank app? Send it to the same GCash number.",
        "2. Before sending, write your account number ACC-000001 in the GCash message.",
        ...(page
          ? ["3. Send a screenshot of your payment to our Facebook page:", page]
          : ["3. Send a screenshot of your payment to TERANETWORK."]),
      ]
    : [
        page
          ? `To pay, message TERANETWORK on Facebook: ${page}`
          : "To pay, please contact TERANETWORK.",
      ];

  return (
    <div
      className="mt-2 px-4 py-3.5"
      style={{
        borderRadius: 10,
        border: "1px solid var(--color-line)",
        background: "var(--color-surface-sunken)",
      }}
    >
      <p className="m-0 mb-2" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
        Preview: how to pay, as printed on invoices and billing emails
      </p>
      {lines.map((line) => (
        <p
          key={line}
          className="m-0 mb-1 wrap-break-word"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          {line}
        </p>
      ))}
      {!number && (
        <p className="m-0 mt-2" style={{ fontSize: 12, color: "var(--color-warning)" }}>
          Add the GCash number so customers know where to send payment.
        </p>
      )}
    </div>
  );
};

const SettingsPage = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("settings", null, "write");

  const { data, isLoading, error } = useGetSettings();
  const updateMutation = useUpdateSettings();
  const settings = data?.data?.settings;

  const form = useForm({ resolver: zodResolver(schema), defaultValues: EMPTY });
  const {
    formState: { isDirty },
  } = form;

  useEffect(() => {
    if (settings) form.reset(toFormValues(settings));
  }, [settings, form]);

  const onSubmit = (values) => {
    updateMutation.mutate(values, {
      onSuccess: (response) => {
        const saved = response?.data?.settings;
        if (saved) form.reset(toFormValues(saved));
      },
    });
  };

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Failed to load settings</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Settings"
        subtitle="Manage settings and configuration for your branch."
      />

      <div
        className="max-w-2xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner size="large" />
          </div>
        ) : (
          <div className="px-4.5 py-5">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} autoComplete="off">
                <SectionLabel>General</SectionLabel>
                <FormField
                  control={form.control}
                  name="companyDisplayName"
                  render={({ field }) => (
                    <FormItem className="mb-5">
                      <FormLabel>Company display name</FormLabel>
                      <div className="relative">
                        <Building2
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input
                            placeholder="e.g., Acme Corp"
                            className="h-10 pl-9"
                            disabled={!canWrite}
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
                  name="supportEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Support email</FormLabel>
                      <div className="relative">
                        <Mail
                          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                          style={{ color: "var(--color-text-muted)" }}
                        />
                        <FormControl>
                          <Input
                            placeholder="support@example.com"
                            className="h-10 pl-9"
                            disabled={!canWrite}
                            {...field}
                          />
                        </FormControl>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="mt-7">
                  <SectionLabel>Localization</SectionLabel>
                  <FormField
                    control={form.control}
                    name="dateFormat"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>Date format</FormLabel>
                        <Select
                          value={field.value || undefined}
                          onValueChange={field.onChange}
                          disabled={!canWrite}
                        >
                          <FormControl>
                            <SelectTrigger className="h-10 w-full">
                              <SelectValue placeholder="Select a format" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {DATE_FORMAT_OPTIONS.map((o) => (
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
                  <FormField
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>Timezone</FormLabel>
                        <div className="relative">
                          <Clock
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="e.g., Asia/Manila"
                              className="h-10 pl-9"
                              disabled={!canWrite}
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
                    name="weekStartsOn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Week starts on</FormLabel>
                        <StatusToggle
                          value={field.value}
                          onChange={field.onChange}
                          options={WEEK_START_OPTIONS}
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="mt-7">
                  <SectionLabel>How customers pay</SectionLabel>
                  <FormField
                    control={form.control}
                    name="gcashNumber"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>GCash number</FormLabel>
                        <div className="relative">
                          <Smartphone
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder={PHONE_PLACEHOLDER}
                              className="h-10 pl-9 font-mono"
                              inputMode="numeric"
                              disabled={!canWrite}
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
                    name="gcashAccountName"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>GCash account name</FormLabel>
                        <div className="relative">
                          <UserRound
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="e.g., JU** DE** C."
                              className="h-10 pl-9"
                              disabled={!canWrite}
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          Customers check this before sending, so write it the way GCash
                          shows it.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="facebookPageUrl"
                    render={({ field }) => (
                      <FormItem className="mb-5">
                        <FormLabel>Facebook page link</FormLabel>
                        <div className="relative">
                          <Link2
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2"
                            style={{ color: "var(--color-text-muted)" }}
                          />
                          <FormControl>
                            <Input
                              placeholder="https://www.facebook.com/teranetwork"
                              className="h-10 pl-9"
                              disabled={!canWrite}
                              {...field}
                            />
                          </FormControl>
                        </div>
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          Where customers send their proof of payment.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <PaymentPreview control={form.control} />

                  <FormField
                    control={form.control}
                    name="invoiceTerms"
                    render={({ field }) => (
                      <FormItem className="mt-5">
                        <FormLabel>Terms and conditions</FormLabel>
                        <FormControl>
                          <Textarea
                            rows={4}
                            placeholder="e.g., Pay by the due date to avoid temporary disconnection."
                            disabled={!canWrite}
                            {...field}
                          />
                        </FormControl>
                        <p
                          className="m-0 mt-1.5"
                          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                        >
                          Printed at the bottom of every invoice. Leave blank to leave it off.
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {canWrite && (
                  <div
                    className="mt-7 pt-5 flex items-center gap-2 justify-end"
                    style={{ borderTop: "1px solid var(--color-line)" }}
                  >
                    <Calendar
                      className="w-3.5 h-3.5"
                      style={{ color: "var(--color-text-muted)" }}
                    />
                    <span
                      className="mr-auto"
                      style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                    >
                      Applies to your current branch.
                    </span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex">
                          <Button
                            type="submit"
                            size="lg"
                            disabled={!isDirty || updateMutation.isPending}
                          >
                            {updateMutation.isPending && (
                              <Loader2 className="animate-spin" />
                            )}
                            Save Changes
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {!isDirty && (
                        <TooltipContent>No changes to save yet</TooltipContent>
                      )}
                    </Tooltip>
                  </div>
                )}
              </form>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
