import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Building2, Calendar, CircleAlert, Clock, Loader2, Mail } from "lucide-react";

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
});

const EMPTY = {
  companyDisplayName: "",
  supportEmail: "",
  dateFormat: "MMM D, YYYY",
  timezone: "",
  weekStartsOn: "Monday",
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
    if (settings) form.reset({ ...EMPTY, ...settings });
  }, [settings, form]);

  const onSubmit = (values) => {
    updateMutation.mutate(values, {
      onSuccess: (response) => {
        const saved = response?.data?.settings;
        if (saved) form.reset({ ...EMPTY, ...saved });
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
          <div className="px-[18px] py-5">
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
