import { useCallback, useMemo, useState } from "react";
import { Import } from "lucide-react";
import dayjs from "dayjs";

import RowActions from "../../../../components/RowActions";
import { usePermissions } from "../../../../hooks/usePermissions";
import {
  useGetDiscoveredItems,
  useGetDiscoveryRuns,
} from "../../../../services/requests/admin/network/discovery";
import { useGetOlts } from "../../../../services/requests/admin/network/olts";
import { decodeHTML } from "../../../../utils/decode-html";

/**
 * The three buckets, and what each asks of the person reading them.
 *
 * `new` is the only one with an action attached — it is work. `orphaned` is a
 * question, not a task: a modem drops off a sweep because a fibre is cut or a
 * family is on holiday as often as because it is really gone.
 */
export const MATCH_STATUS = {
  new: {
    label: "Not on file",
    color: "var(--color-warning)",
    hint: "on the OLT, not in your records",
  },
  matched: {
    label: "Known",
    color: "var(--color-success)",
    hint: "already in your records",
  },
  orphaned: {
    label: "Not reported",
    color: "var(--color-error)",
    hint: "in your records, the OLT did not report it",
  },
};

export const useDiscoveryData = () => {
  const { hasPermission } = usePermissions();
  const canWrite = hasPermission("network", "discovery", "write");

  const [selectedRunId, setSelectedRunId] = useState(null);
  // 'new' first: it is the bucket with work in it, and the reason the screen
  // gets opened.
  const [bucket, setBucket] = useState("new");
  const [search, setSearch] = useState("");
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25 });
  const [importItem, setImportItem] = useState(null);
  const [sweepOpen, setSweepOpen] = useState(false);

  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useGetDiscoveryRuns({
    page: 1,
    pageSize: 20,
  });

  const runs = useMemo(() => runsData?.data?.runs ?? [], [runsData]);

  // Default to the newest run, DERIVED rather than synced into state. An effect
  // that copied it into `selectedRunId` would render once with nothing chosen
  // and once with the run, and would need a second effect to cope with the list
  // arriving after a sweep.
  const effectiveRunId = selectedRunId ?? runs[0]?.discoveryRunId ?? null;

  const selectedRun = useMemo(
    () => runs.find((r) => r.discoveryRunId === effectiveRunId) ?? null,
    [runs, effectiveRunId]
  );

  const {
    data: itemsData,
    isLoading: itemsLoading,
    isFetching,
    error,
    refetch: refetchItems,
  } = useGetDiscoveredItems(effectiveRunId, {
    page: pagination.current,
    pageSize: pagination.pageSize,
    search,
    matchStatus: bucket,
  });

  const { data: oltsData } = useGetOlts({ page: 1, pageSize: 100, status: "Active" });
  const oltOptions = useMemo(
    () =>
      (oltsData?.data?.olts || []).map((o) => ({
        value: o.oltId,
        label: decodeHTML(o.name),
      })),
    [oltsData]
  );

  const handleSelectRun = useCallback((discoveryRunId) => {
    setSelectedRunId(discoveryRunId);
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleBucketChange = useCallback((next) => {
    setBucket(next);
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleSearch = useCallback((value) => {
    setSearch(value);
    setPagination((prev) => ({ ...prev, current: 1 }));
  }, []);

  const handleTableChange = useCallback((next) => {
    setPagination({ current: next.current, pageSize: next.pageSize });
  }, []);

  const handleImport = useCallback((record) => setImportItem(record), []);
  const handleCloseImport = useCallback(() => setImportItem(null), []);
  const handleOpenSweep = useCallback(() => setSweepOpen(true), []);
  const handleCloseSweep = useCallback(() => setSweepOpen(false), []);

  const refetch = useCallback(() => {
    refetchRuns();
    refetchItems();
  }, [refetchRuns, refetchItems]);

  const getActionItems = useCallback(
    (record) => {
      // Only an unimported `new` item can be acted on. A matched modem is
      // already inventory; an orphan needs investigating, not importing.
      if (!canWrite || record.matchStatus !== "new" || record.importedAt) return [];

      return [
        {
          key: "import",
          label: "Add to inventory",
          icon: <Import className="w-4 h-4" />,
          onClick: () => handleImport(record),
        },
      ];
    },
    [canWrite, handleImport]
  );

  const columns = useMemo(
    () => [
      {
        title: "Modem",
        key: "modem",
        render: (_, record) => {
          const raw = record.raw ?? {};
          return (
            <div className="min-w-0">
              <div
                className="font-mono truncate"
                style={{ fontSize: 13, color: "var(--color-text-dark)" }}
              >
                {record.externalKey}
              </div>
              <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {decodeHTML(raw.model) || "Unknown model"}
                {raw.onuIndex ? ` · ${raw.onuIndex}` : ""}
              </div>
            </div>
          );
        },
      },
      {
        title: "What the OLT calls it",
        key: "description",
        ellipsis: true,
        render: (_, record) => {
          const raw = record.raw ?? {};
          const suggested = record.suggested ?? {};
          return (
            <div className="min-w-0">
              <div
                className="truncate"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                {decodeHTML(raw.description) || "—"}
              </div>
              {/* The reading of it, shown under the original so a wrong parse is
                  obvious rather than silently carried into the form. */}
              {suggested.name && (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  reads as {decodeHTML(suggested.name)}
                  {suggested.nap ? ` · NAP ${suggested.nap}` : ""}
                  {suggested.port ? ` port ${suggested.port}` : ""}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Link",
        key: "online",
        width: 110,
        render: (_, record) => {
          const online = record.raw?.online;
          if (online === undefined || online === null) {
            return <span style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>—</span>;
          }
          return (
            <span
              className="inline-flex items-center gap-2"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: online ? "var(--color-success)" : "var(--color-text-muted)",
                }}
              />
              {online ? "Up" : "Down"}
            </span>
          );
        },
      },
      {
        title: "Status",
        key: "matchStatus",
        width: 190,
        render: (_, record) => {
          const meta = MATCH_STATUS[record.matchStatus] ?? MATCH_STATUS.new;
          return (
            <div className="min-w-0">
              <span
                className="inline-flex items-center gap-2"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                <span
                  style={{ width: 7, height: 7, borderRadius: "50%", background: meta.color }}
                />
                {record.importedAt ? "Imported" : meta.label}
              </span>
              <div className="truncate" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                {record.importedAt
                  ? dayjs(record.importedAt).format("MMM D, YYYY")
                  : meta.hint}
              </div>
            </div>
          );
        },
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) => {
          const items = getActionItems(record);
          return items.length > 0 ? <RowActions items={items} /> : null;
        },
      },
    ],
    [getActionItems]
  );

  return {
    runs,
    runsLoading,
    selectedRun,
    selectedRunId: effectiveRunId,
    handleSelectRun,
    items: itemsData?.data?.items ?? [],
    pagination: { ...pagination, total: itemsData?.data?.pagination?.total ?? 0 },
    bucket,
    handleBucketChange,
    search,
    handleSearch,
    handleTableChange,
    itemsLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    oltOptions,
    importItem,
    handleCloseImport,
    sweepOpen,
    handleOpenSweep,
    handleCloseSweep,
  };
};
