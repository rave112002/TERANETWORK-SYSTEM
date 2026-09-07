import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { CircleAlert, Loader2, Save, ShieldAlert, TriangleAlert } from "lucide-react";

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
import { Switch } from "@/components/ui/switch";

import { useSystemData } from "./hooks";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import RefreshButton from "../../../components/RefreshButton";
import SectionLabel from "../../../components/SectionLabel";
import Spinner from "../../../components/Spinner";
import DataTable from "../../../components/DataTable";

const schema = z.object({
  GRACE_DAYS: z.coerce
    .number({ invalid_type_error: "Enter a number of days" })
    .int("Whole days only")
    .min(0, "Cannot be negative")
    .max(365, "More than a year is almost certainly a mistake"),
  VAT_RATE: z.coerce
    .number({ invalid_type_error: "Enter a rate" })
    .min(0, "Cannot be negative")
    .max(1, "Enter a fraction, e.g. 0.12 for 12%"),
});

const SystemPage = () => {
  const {
    settings,
    stats,
    settingsLoading,
    settingsError,
    isSaving,
    canWrite,
    jobs,
    jobsLoading,
    jobsFetching,
    refetchJobs,
    jobColumns,
    jobFilters,
    pagination,
    handleDryRunToggle,
    handleSaveSettings,
    handleJobFilter,
    handleTableChange,
  } = useSystemData();

  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: { GRACE_DAYS: "0", VAT_RATE: "0" },
  });
  const {
    formState: { isDirty },
  } = form;

  useEffect(() => {
    if (!settings) return;
    form.reset({
      GRACE_DAYS: String(settings.GRACE_DAYS ?? 0),
      VAT_RATE: String(settings.VAT_RATE ?? 0),
    });
  }, [settings, form]);

  if (settingsError) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading system settings</AlertTitle>
          <AlertDescription>
            {settingsError.response?.data?.message || settingsError.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const dryRun = Boolean(settings?.DRY_RUN);
  const deadJobs = Number(stats.dead) || 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="System"
        subtitle="Runtime settings and the background job queue."
      />

      {/* Two banners, in order of urgency. A dead job means a customer is in a
          state nobody intended and nothing further is coming. */}
      {deadJobs > 0 && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertTitle>
            {deadJobs} job{deadJobs === 1 ? "" : "s"} gave up after every retry
          </AlertTitle>
          <AlertDescription>
            Each one left its customer in whatever state they were already in — nothing was
            half-applied — but no further attempt will be made. Check the last error below.
          </AlertDescription>
        </Alert>
      )}

      {dryRun && (
        <Alert>
          <ShieldAlert />
          <AlertTitle>Dry-run is on</AlertTitle>
          <AlertDescription>
            Device commands are being logged, not executed. Nobody is being disconnected or
            reconnected while this is on.
          </AlertDescription>
        </Alert>
      )}

      {settingsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Spinner size="large" />
        </div>
      ) : (
        <div
          className="max-w-2xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <div className="px-4.5 py-5">
            <SectionLabel>Safety</SectionLabel>

            <div className="flex items-start justify-between gap-4 mb-2">
              <div className="min-w-0">
                <div style={{ fontSize: 14, fontWeight: 500, color: "var(--color-text-dark)" }}>
                  Dry-run mode
                </div>
                <p
                  className="m-0 mt-1"
                  style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
                >
                  Rehearse everything without touching a device. The worker records the exact
                  command it would have sent and stops there.
                </p>
              </div>
              <Switch
                checked={dryRun}
                onCheckedChange={handleDryRunToggle}
                disabled={!canWrite || isSaving}
                aria-label="Dry-run mode"
              />
            </div>

            <div className="mt-7">
              <SectionLabel>Billing rules</SectionLabel>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleSaveSettings)} autoComplete="off">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="GRACE_DAYS"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Grace days</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={0}
                              max={365}
                              className="h-10"
                              disabled={!canWrite}
                              {...field}
                            />
                          </FormControl>
                          <p
                            className="m-0 mt-1.5"
                            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                          >
                            Days after the due date before service is suspended.{" "}
                            <strong>0 means the due date itself</strong> — the client&apos;s
                            current rule.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="VAT_RATE"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>VAT rate</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              step="0.01"
                              min={0}
                              max={1}
                              className="h-10"
                              disabled={!canWrite}
                              {...field}
                            />
                          </FormControl>
                          <p
                            className="m-0 mt-1.5"
                            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
                          >
                            A fraction, not a percentage: enter 0.12 for 12%. Currently 0.
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {canWrite && (
                    <div
                      className="mt-7 pt-5 flex justify-end"
                      style={{ borderTop: "1px solid var(--color-line)" }}
                    >
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
        </div>
      )}

      {/* ── Job queue ────────────────────────────────────────────────── */}
      <div
        className="bg-surface overflow-hidden"
        style={{
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        <div
          className="flex items-center justify-between gap-3 flex-wrap px-4.5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <div className="flex items-center gap-4 flex-wrap">
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--color-text-dark)" }}>
              Job queue
            </span>
            {["queued", "processing", "dead"].map((key) => (
              <span
                key={key}
                style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
              >
                {key}: <strong>{Number(stats[key]) || 0}</strong>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Select
              value={jobFilters.status || "all"}
              onValueChange={(v) => handleJobFilter("status", v === "all" ? "" : v)}
            >
              <SelectTrigger className="h-9 w-40">
                <SelectValue placeholder="Any status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any status</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="processing">Processing</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="dead">Dead</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
            <RefreshButton onRefresh={refetchJobs} isFetching={jobsFetching} />
          </div>
        </div>

        {!jobsLoading && jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              Nothing in the queue
            </p>
            <p style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
              Jobs appear here when the scheduler or a staff action enqueues device or email work.
            </p>
          </div>
        ) : (
          <>
            <DataTable
              dataSource={jobs}
              columns={jobColumns}
              rowKey="jobId"
              loading={jobsLoading}
              scroll={{ x: 900 }}
            />
            <PaginationFooter
              pagination={pagination}
              onChange={handleTableChange}
              noun="job"
            />
          </>
        )}
      </div>
    </div>
  );
};

export default SystemPage;
