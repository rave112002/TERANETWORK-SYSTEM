import { CircleAlert, ShieldAlert, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { useSystemData } from "./hooks";
import DataTable from "../../../components/DataTable";
import PageHeader from "../../../components/PageHeader";
import PaginationFooter from "../../../components/PaginationFooter";
import RefreshButton from "../../../components/RefreshButton";
import Spinner from "../../../components/Spinner";
import SystemSettingsPanel from "../../../components/system/SystemSettingsPanel";

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
          className="max-w-4xl"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <SystemSettingsPanel
            settings={settings}
            canWrite={canWrite}
            isSaving={isSaving}
            onDryRunChange={handleDryRunToggle}
            onSave={handleSaveSettings}
          />
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
