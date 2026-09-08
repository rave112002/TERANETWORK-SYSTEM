import { CircleAlert, RadioTower, ScanSearch } from "lucide-react";
import dayjs from "dayjs";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { MATCH_STATUS, useDiscoveryData } from "./hooks";
import ImportDrawer from "./components/ImportDrawer";
import SweepDrawer from "./components/SweepDrawer";
import PageHeader from "../../../../components/PageHeader";
import PaginationFooter from "../../../../components/PaginationFooter";
import RefreshButton from "../../../../components/RefreshButton";
import SearchInput from "../../../../components/SearchInput";
import DataTable from "../../../../components/DataTable";

const DiscoveryPage = () => {
  const {
    runs,
    runsLoading,
    selectedRun,
    selectedRunId,
    handleSelectRun,
    items,
    pagination,
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
  } = useDiscoveryData();

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading discovery</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const counts = selectedRun
    ? { new: selectedRun.newCount, matched: selectedRun.matchedCount, orphaned: selectedRun.orphanedCount }
    : { new: 0, matched: 0, orphaned: 0 };

  const noRuns = !runsLoading && runs.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Discovery"
        subtitle="Ask an OLT what it can see, and compare that with your records. A sweep changes nothing on its own."
        actions={
          canWrite && (
            <Button onClick={handleOpenSweep}>
              <ScanSearch />
              Sweep an OLT
            </Button>
          )
        }
      />

      {noRuns ? (
        <div
          className="flex flex-col items-center justify-center gap-4 py-24 text-center bg-surface"
          style={{
            border: "1px solid var(--color-line)",
            borderRadius: "var(--radius-card)",
          }}
        >
          <RadioTower className="w-9 h-9" style={{ color: "var(--color-text-muted)" }} />
          <div>
            <p className="m-0" style={{ fontSize: 14, color: "var(--color-text-dark)" }}>
              No sweeps yet
            </p>
            <p
              className="m-0 mt-1 max-w-md"
              style={{ fontSize: 13, color: "var(--color-text-muted)" }}
            >
              A sweep reads the modems an OLT can see and shows you which ones are missing
              from your records. It reads only — nothing is created until you say so.
            </p>
          </div>
          {canWrite && (
            <Button onClick={handleOpenSweep}>
              <ScanSearch />
              Sweep an OLT
            </Button>
          )}
        </div>
      ) : (
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
            <div className="flex items-center gap-3 flex-wrap">
              {/* Which sweep is being looked at. Runs are kept, so "it was there
                  in August and gone in September" is answerable. */}
              <Select value={selectedRunId ?? ""} onValueChange={handleSelectRun}>
                <SelectTrigger className="h-10 w-72">
                  <SelectValue placeholder="Choose a sweep" />
                </SelectTrigger>
                <SelectContent>
                  {runs.map((run) => (
                    <SelectItem key={run.discoveryRunId} value={run.discoveryRunId}>
                      <span className="flex flex-col items-start">
                        <span>{run.oltName}</span>
                        <span style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                          {dayjs(run.dateCreated).format("MMM D, YYYY HH:mm")}
                          {run.status === "failed" ? " · failed" : ""}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <SearchInput
                value={search}
                onChange={handleSearch}
                placeholder="Search MAC, model, description…"
              />
            </div>

            <RefreshButton onRefresh={refetch} isFetching={isFetching} />
          </div>

          {selectedRun?.status === "failed" && (
            <div
              className="px-4.5 py-3.5"
              style={{
                borderBottom: "1px solid var(--color-line)",
                background: "var(--color-surface-sunken)",
              }}
            >
              <p
                className="m-0"
                style={{ fontSize: 13, fontWeight: 600, color: "var(--color-error)" }}
              >
                This sweep did not complete
              </p>
              <p
                className="m-0 mt-1"
                style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
              >
                {selectedRun.error || "The OLT did not answer."} Nothing was compared, so this
                is not evidence that any modem is missing.
              </p>
            </div>
          )}

          <div
            className="flex items-center gap-2 flex-wrap px-4.5 py-3.5"
            style={{ borderBottom: "1px solid var(--color-line)" }}
          >
            {Object.entries(MATCH_STATUS).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => handleBucketChange(key)}
                className="h-8 px-3 text-[13px] cursor-pointer inline-flex items-center gap-2 transition-colors"
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  background: bucket === key ? "var(--color-surface-sunken)" : "transparent",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }}
                />
                {meta.label}
                <span style={{ color: "var(--color-text-muted)" }}>{counts[key] ?? 0}</span>
              </button>
            ))}
          </div>

          {!itemsLoading && items.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
                {bucket === "new"
                  ? "Every modem this OLT reported is already in your records"
                  : bucket === "orphaned"
                    ? "Every modem in your records was reported by the OLT"
                    : "Nothing in this bucket"}
              </p>
              {bucket === "orphaned" && (
                <p style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
                  Which is the answer you want.
                </p>
              )}
            </div>
          ) : (
            <>
              <DataTable
                dataSource={items}
                columns={columns}
                rowKey="discoveredItemId"
                loading={itemsLoading}
                scroll={{ x: 900 }}
              />
              <PaginationFooter
                pagination={pagination}
                onChange={handleTableChange}
                noun="modem"
              />
            </>
          )}
        </div>
      )}

      <ImportDrawer open={!!importItem} item={importItem} onClose={handleCloseImport} />
      <SweepDrawer open={sweepOpen} onClose={handleCloseSweep} oltOptions={oltOptions} />
    </div>
  );
};

export default DiscoveryPage;
