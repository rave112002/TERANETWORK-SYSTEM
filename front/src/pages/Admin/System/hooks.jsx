import { useCallback, useMemo, useState } from "react";
import dayjs from "dayjs";

import { usePermissions } from "../../../hooks/usePermissions";
import {
  useGetJobs,
  useGetSystemSettings,
  useUpdateSystemSettings,
} from "../../../services/requests/admin/system";

/**
 * `dead` is the only status here that needs a person. Everything else is the
 * queue working as designed — including `failed`, which is on its way to being
 * retried.
 */
export const JOB_STATUS = {
  queued: { label: "Queued", color: "var(--color-text-muted)" },
  processing: { label: "Processing", color: "var(--color-link)" },
  succeeded: { label: "Succeeded", color: "var(--color-success)" },
  failed: { label: "Failed", color: "var(--color-warning)" },
  dead: { label: "Dead", color: "var(--color-error)" },
  cancelled: { label: "Cancelled", color: "var(--color-text-muted)" },
};

export const useSystemData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("system", null, "write");

  const [jobFilters, setJobFilters] = useState({ status: "", type: "" });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });

  const settingsQuery = useGetSystemSettings();
  const updateMutation = useUpdateSystemSettings();

  const jobsQuery = useGetJobs({
    page: pagination.current,
    pageSize: pagination.pageSize,
    status: jobFilters.status,
    type: jobFilters.type,
  });

  const settings = settingsQuery.data?.data?.settings;
  const stats = jobsQuery.data?.data?.stats ?? {};

  // The confirmation before turning dry-run off lives in SystemSettingsPanel,
  // so it is the same here and in the central SuperAdmin.
  const handleDryRunToggle = useCallback(
    (next) => updateMutation.mutate({ DRY_RUN: next }),
    [updateMutation],
  );

  const handleSaveSettings = useCallback(
    (values) => updateMutation.mutate(values),
    [updateMutation],
  );

  const handleJobFilter = useCallback((key, value) => {
    setJobFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleTableChange = useCallback((next) => {
    setPagination({ current: next.current, pageSize: next.pageSize });
  }, []);

  const jobColumns = useMemo(
    () => [
      {
        title: "Job",
        key: "job",
        render: (_, record) => (
          <div className="min-w-0">
            <div style={{ fontSize: 13.5, fontWeight: 500, color: "var(--color-text-dark)" }}>
              {record.type}
            </div>
            <div
              className="font-mono truncate"
              style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
            >
              {record.dedupeKey || record.jobId}
            </div>
          </div>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (status) => {
          const meta = JOB_STATUS[status] || JOB_STATUS.queued;
          return (
            <span
              className="inline-flex items-center gap-2"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              <span
                style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }}
              />
              {meta.label}
            </span>
          );
        },
      },
      {
        title: "Attempts",
        key: "attempts",
        width: 110,
        render: (_, record) => (
          <span
            className="font-mono"
            style={{
              fontSize: 12.5,
              // Amber once it is on its last life, so a job about to die is
              // visible before it does.
              color:
                record.attempts >= record.maxAttempts
                  ? "var(--color-error)"
                  : record.attempts > 1
                    ? "var(--color-warning)"
                    : "var(--color-text-secondary)",
            }}
          >
            {record.attempts} / {record.maxAttempts}
          </span>
        ),
      },
      {
        title: "Next run",
        dataIndex: "nextRunAt",
        key: "nextRunAt",
        width: 170,
        render: (nextRunAt, record) =>
          ["succeeded", "cancelled", "dead"].includes(record.status) ? (
            <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>—</span>
          ) : (
            <span style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
              {dayjs(nextRunAt).format("MMM D, HH:mm:ss")}
            </span>
          ),
      },
      {
        title: "Last error",
        dataIndex: "lastError",
        key: "lastError",
        ellipsis: true,
        render: (lastError) => (
          <span
            className="truncate"
            style={{
              fontSize: 12.5,
              color: lastError ? "var(--color-error)" : "var(--color-text-muted)",
            }}
          >
            {lastError || "—"}
          </span>
        ),
      },
    ],
    [],
  );

  return {
    settings,
    stats,
    settingsLoading: settingsQuery.isLoading,
    settingsError: settingsQuery.error,
    isSaving: updateMutation.isPending,
    canWrite,

    jobs: jobsQuery.data?.data?.jobs || [],
    jobsLoading: jobsQuery.isLoading,
    jobsFetching: jobsQuery.isFetching,
    jobsError: jobsQuery.error,
    refetchJobs: jobsQuery.refetch,
    jobColumns,
    jobFilters,
    pagination: { ...pagination, total: jobsQuery.data?.data?.pagination?.total || 0 },

    handleDryRunToggle,
    handleSaveSettings,
    handleJobFilter,
    handleTableChange,
  };
};
