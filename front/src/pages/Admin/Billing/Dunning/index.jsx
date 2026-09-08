import { CircleAlert, Clock, PowerOff, ShieldCheck, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { RISK_STATE, useDunningData } from "./hooks";
import ExemptionDrawer from "./components/ExemptionDrawer";
import SweepDrawer from "./components/SweepDrawer";
import PageHeader from "../../../../components/PageHeader";
import StatCard from "../../../../components/StatCard";
import RefreshButton from "../../../../components/RefreshButton";
import DataTable from "../../../../components/DataTable";

const DunningPage = () => {
  const {
    atRisk,
    summary,
    graceDays,
    isLoading,
    isFetching,
    error,
    refetch,
    canWrite,
    columns,
    stateFilter,
    setStateFilter,
    exemptSubscription,
    handleCloseExempt,
    sweepOpen,
    handleOpenSweep,
    handleCloseSweep,
  } = useDunningData();

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Error loading at-risk accounts</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Failed to load."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isEmpty = !isLoading && atRisk.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Dunning"
        subtitle={`Accounts heading for disconnection. Grace period is ${graceDays} day${graceDays === 1 ? "" : "s"} after the due date.`}
        actions={
          canWrite && (
            <Button variant="outline" onClick={handleOpenSweep}>
              <PowerOff />
              Run sweep
            </Button>
          )
        }
      />

      {/* The point of this screen is the middle number: people you can still
          phone before anything happens to them. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatCard
          title="Eligible now"
          value={summary.eligible}
          change="will be cut off by the next sweep"
          icon={<TriangleAlert className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="In grace"
          value={summary.in_grace}
          change="still time to reach them"
          icon={<Clock className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Exempt"
          value={summary.exempt}
          change="shielded by staff"
          icon={<ShieldCheck className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Suspended"
          value={summary.suspended}
          change="already disconnected"
          icon={<PowerOff className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>

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
          {/* Filtering is a row of chips rather than a dropdown: there are four
              states, and which one you want is the first decision you make. */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setStateFilter("")}
              className="h-8 px-3 text-[13px] cursor-pointer transition-colors"
              style={{
                borderRadius: 8,
                border: "1px solid var(--color-line)",
                background: stateFilter === "" ? "var(--color-surface-sunken)" : "transparent",
                color: "var(--color-text-secondary)",
              }}
            >
              All
            </button>
            {Object.entries(RISK_STATE).map(([key, meta]) => (
              <button
                key={key}
                type="button"
                onClick={() => setStateFilter(stateFilter === key ? "" : key)}
                className="h-8 px-3 text-[13px] cursor-pointer inline-flex items-center gap-2 transition-colors"
                style={{
                  borderRadius: 8,
                  border: "1px solid var(--color-line)",
                  background:
                    stateFilter === key ? "var(--color-surface-sunken)" : "transparent",
                  color: "var(--color-text-secondary)",
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }}
                />
                {meta.label}
              </button>
            ))}
          </div>

          <RefreshButton onRefresh={refetch} isFetching={isFetching} />
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <ShieldCheck className="w-8 h-8" style={{ color: "var(--color-success)" }} />
            <p style={{ fontSize: 13.5, color: "var(--color-text-muted)" }}>
              {stateFilter ? "Nobody in this state" : "Nobody is overdue"}
            </p>
          </div>
        ) : (
          <DataTable
            dataSource={atRisk}
            columns={columns}
            rowKey="subscriptionId"
            loading={isLoading}
            scroll={{ x: 800 }}
          />
        )}
      </div>

      <ExemptionDrawer
        open={!!exemptSubscription}
        record={exemptSubscription}
        onClose={handleCloseExempt}
      />
      <SweepDrawer open={sweepOpen} onClose={handleCloseSweep} graceDays={graceDays} />
    </div>
  );
};

export default DunningPage;
