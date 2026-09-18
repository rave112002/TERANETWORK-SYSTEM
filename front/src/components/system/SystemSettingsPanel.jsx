import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { Loader2, Save } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";

import SectionLabel from "../SectionLabel";
import { confirm } from "../../store/confirmStore";
import { asHour, describeSchedule } from "./schedule";

/**
 * The dry-run switch and the billing schedule — one component for both places
 * these are edited:
 *
 *   - the branch's own System page (Admin portal)
 *   - the central SuperAdmin's System settings page, per branch (D10)
 *
 * Both save through the branch's lib/settings/systemSettings.service.js, so the
 * form, its checks and its wording are shared here to match.
 *
 * @param {Object} props
 * @param {Object|null} props.settings  typed values from the branch
 * @param {boolean} props.canWrite
 * @param {boolean} props.isSaving
 * @param {(next: boolean) => void} props.onDryRunChange  called after confirmation when turning it off
 * @param {(values: Object) => void} props.onSave         the schedule and rules, as entered
 * @param {React.ReactNode} [props.footerNote]            shown beside the Save button
 */

/**
 * A day the calendar has in every month.
 *
 * 28 is the ceiling because 29, 30 and 31 would make the schedule move on its
 * own each February. The backend enforces the same bound.
 */
const dayOfMonth = z.coerce
  .number({ invalid_type_error: "Enter a day of the month" })
  .int("Whole days only")
  .min(1, "The 1st at the earliest")
  .max(28, "The 28th at the latest — later days do not exist in February");

const hourOfDay = z.coerce.number({ invalid_type_error: "Pick an hour" }).int().min(0).max(23);

/** Every hour of the day, for the three run-time selects. */
const HOURS = Array.from({ length: 24 }, (_, h) => String(h));

const schema = z
  .object({
    GRACE_DAYS: z.coerce
      .number({ invalid_type_error: "Enter a number of days" })
      .int("Whole days only")
      .min(0, "Cannot be negative")
      .max(365, "More than a year is almost certainly a mistake"),
    VAT_RATE: z.coerce
      .number({ invalid_type_error: "Enter a rate" })
      .min(0, "Cannot be negative")
      .max(1, "Enter a fraction, e.g. 0.12 for 12%"),
    STATEMENT_DAY: dayOfMonth,
    DUE_DAY: dayOfMonth,
    REMINDER_DAYS_BEFORE: z.coerce
      .number({ invalid_type_error: "Enter a number of days" })
      .int("Whole days only")
      .min(0, "Cannot be negative")
      .max(28, "More than 28 days ahead would land in the wrong month"),
    CYCLE_HOUR: hourOfDay,
    DAILY_HOUR: hourOfDay,
    DUNNING_HOUR: hourOfDay,
    RECOVERY_AFTER_DAYS: z.coerce
      .number({ invalid_type_error: "Enter a number of days" })
      .int("Whole days only")
      .min(1, "At least one day")
      .max(365, "More than a year is almost certainly a mistake"),
  })
  // ── The two rules the backend also enforces ─────────────────────────────
  //
  // Checked here as well so the explanation appears under the field being
  // edited rather than as a toast after a round trip. The server is still the
  // authority: it merges these values with what is stored before deciding.
  .refine((v) => v.STATEMENT_DAY > v.DUE_DAY + v.GRACE_DAYS, {
    path: ["STATEMENT_DAY"],
    message:
      "Invoices must go out after the previous month's cut-off day. Issue them earlier and a customer who is disconnected and then reconnects is billed for a month they had no service.",
  })
  .refine((v) => v.DAILY_HOUR < v.DUNNING_HOUR, {
    path: ["DAILY_HOUR"],
    message:
      "Notices have to go out before the disconnection sweep, or customers are cut off the evening before they are warned.",
  });

const DEFAULTS = {
  GRACE_DAYS: 0,
  VAT_RATE: 0,
  STATEMENT_DAY: 25,
  DUE_DAY: 2,
  REMINDER_DAYS_BEFORE: 2,
  CYCLE_HOUR: 9,
  DAILY_HOUR: 8,
  DUNNING_HOUR: 20,
  RECOVERY_AFTER_DAYS: 60,
};

const toFormValues = (settings) =>
  Object.fromEntries(
    Object.entries(DEFAULTS).map(([key, fallback]) => [key, String(settings?.[key] ?? fallback)])
  );

/**
 * A hint under a field. Every setting on this screen changes what happens to a
 * customer, so each one says what it does rather than restating its own label.
 */
const Hint = ({ children }) =>
  children ? (
    <p className="m-0 mt-1.5" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
      {children}
    </p>
  ) : null;

const NumberField = ({ control, name, label, hint, min, max, step, disabled }) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <FormControl>
          <Input type="number" min={min} max={max} step={step} className="h-10" disabled={disabled} {...field} />
        </FormControl>
        <Hint>{hint}</Hint>
        <FormMessage />
      </FormItem>
    )}
  />
);

/**
 * An hour of the day.
 *
 * A select rather than a number input: these are wall-clock times, and typing
 * "8" into a box that means 08:00 leaves it ambiguous whether the schedule runs
 * in the morning or the evening.
 */
const HourField = ({ control, name, label, hint, disabled }) => (
  <FormField
    control={control}
    name={name}
    render={({ field }) => (
      <FormItem>
        <FormLabel>{label}</FormLabel>
        <Select value={String(field.value)} onValueChange={field.onChange} disabled={disabled}>
          <FormControl>
            <SelectTrigger className="h-10 w-full">
              <SelectValue />
            </SelectTrigger>
          </FormControl>
          <SelectContent>
            {HOURS.map((h) => (
              <SelectItem key={h} value={h}>
                {asHour(h)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Hint>{hint}</Hint>
        <FormMessage />
      </FormItem>
    )}
  />
);

const SystemSettingsPanel = ({ settings, canWrite, isSaving, onDryRunChange, onSave, footerNote }) => {
  const form = useForm({ resolver: zodResolver(schema), defaultValues: toFormValues(null) });
  const {
    formState: { isDirty },
  } = form;

  useEffect(() => {
    if (settings) form.reset(toFormValues(settings));
  }, [settings, form]);

  // Watched so the plain-English summary tracks what is being typed, not what
  // was last saved.
  const live = useWatch({ control: form.control });
  const scheduleSentence = describeSchedule({ ...toFormValues(settings), ...live });

  const dryRun = Boolean(settings?.DRY_RUN);

  /**
   * Turning dry-run OFF is the moment the system starts cutting people off for
   * real, so it asks first. Turning it ON is a safety move and goes straight
   * through — a confirmation there would just be friction in an emergency.
   */
  const handleDryRun = async (next) => {
    if (!next) {
      const ok = await confirm({
        title: "Turn dry-run off?",
        description:
          "Device commands will execute for real. The dunning sweep will disconnect customers whose payment is overdue.",
        confirmText: "Turn it off",
        cancelText: "Keep rehearsing",
        danger: true,
      });
      if (!ok) return;
    }
    onDryRunChange(next);
  };

  return (
    <div className="px-4.5 py-5">
      <SectionLabel>Safety</SectionLabel>

      <div className="flex items-start justify-between gap-4 mb-2">
        <div className="min-w-0">
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}>Dry-run mode</div>
          <p className="m-0 mt-1" style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
            Rehearse everything without touching a device. The worker records the exact command it
            would have sent and stops there.
          </p>
        </div>
        <Switch
          checked={dryRun}
          onCheckedChange={handleDryRun}
          disabled={!canWrite || isSaving}
          aria-label="Dry-run mode"
        />
      </div>

      <div className="mt-7">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSave)} autoComplete="off">
            <SectionLabel>Billing schedule</SectionLabel>

            {/* The numbers below, said back as a sentence, live, before saving. */}
            <p
              className="m-0 mb-4 px-3.5 py-3"
              style={{
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--color-text-secondary)",
                background: "var(--color-surface-sunken)",
                borderRadius: "var(--radius-card)",
              }}
            >
              {scheduleSentence}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <NumberField control={form.control} name="STATEMENT_DAY" label="Invoices go out on" min={1} max={28} disabled={!canWrite} hint="The bill still covers the whole month." />
              <NumberField control={form.control} name="DUE_DAY" label="Payment due on" min={1} max={28} disabled={!canWrite} hint="Day of the following month." />
              <NumberField control={form.control} name="REMINDER_DAYS_BEFORE" label="Remind this many days early" min={0} max={28} disabled={!canWrite} hint="0 turns the advance reminder off." />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <HourField control={form.control} name="CYCLE_HOUR" label="Billing run" disabled={!canWrite} hint="When invoices are generated on the day above." />
              <HourField control={form.control} name="DAILY_HOUR" label="Notices" disabled={!canWrite} hint="Reminders and overdue notices, every day." />
              <HourField control={form.control} name="DUNNING_HOUR" label="Disconnections" disabled={!canWrite} hint="When unpaid accounts are suspended." />
            </div>

            <p className="m-0 mt-3" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
              The worker checks these every hour, so a change takes effect on the next hour — no restart.
            </p>

            <div className="mt-7">
              <SectionLabel>Billing rules</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <NumberField control={form.control} name="GRACE_DAYS" label="Grace days" min={0} max={365} disabled={!canWrite} hint="Days after the due date before service is suspended. 0 means the due date itself — the client's current rule." />
                <NumberField control={form.control} name="VAT_RATE" label="VAT rate" step="0.01" min={0} max={1} disabled={!canWrite} hint="A fraction, not a percentage: enter 0.12 for 12%." />
                <NumberField control={form.control} name="RECOVERY_AFTER_DAYS" label="Suggest pull-out after" min={1} max={365} disabled={!canWrite} hint="Days without service before an account appears on Modem Recovery. Nothing happens automatically." />
              </div>
            </div>

            {canWrite && (
              <div className="mt-7 pt-5 flex items-center gap-3 justify-end" style={{ borderTop: "1px solid var(--color-line)" }}>
                {footerNote && (
                  <span className="mr-auto" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                    {footerNote}
                  </span>
                )}
                <Button type="submit" size="lg" disabled={!isDirty || isSaving}>
                  {isSaving ? <Loader2 className="animate-spin" /> : <Save />}
                  Save Changes
                </Button>
              </div>
            )}
          </form>
        </Form>
      </div>
    </div>
  );
};

export default SystemSettingsPanel;
