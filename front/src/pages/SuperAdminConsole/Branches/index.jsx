import { CircleAlert, CircleCheck, Plus, Server, TriangleAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { useBranchesData } from "./hooks";
import BranchFormDrawer from "./components/BranchFormDrawer";
import DataTable from "../../../components/DataTable";
import PageHeader from "../../../components/PageHeader";
import RefreshButton from "../../../components/RefreshButton";
import StatCard from "../../../components/StatCard";

const BranchesPage = () => {
  const {
    branches,
    summary,
    columns,
    isLoading,
    isFetching,
    error,
    formBranch,
    handleAdd,
    handleCloseForm,
    handleCheckAll,
  } = useBranchesData();

  if (error) {
    return (
      <div className="p-8">
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Could not load the branch list</AlertTitle>
          <AlertDescription>
            {error.response?.data?.message || error.message || "Is superadmin-server running?"}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const isEmpty = !isLoading && branches.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Branches"
        subtitle="Every TERANETWORK installation this SuperAdmin manages, checked every 30 seconds."
        actions={
          <Button onClick={handleAdd}>
            <Plus />
            Add branch
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <StatCard
          title="Branches"
          value={summary.total}
          change="managed here"
          icon={<Server className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Online"
          value={summary.online}
          change="reachable and compatible"
          icon={<CircleCheck className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
        <StatCard
          title="Problems"
          value={summary.problems}
          change="offline, wrong key or outdated"
          icon={<TriangleAlert className="w-4.25 h-4.25" strokeWidth={1.8} />}
        />
      </div>

      <div
        className="bg-surface overflow-hidden"
        style={{ border: "1px solid var(--color-line)", borderRadius: "var(--radius-card)" }}
      >
        <div
          className="flex items-center justify-between gap-3 px-4.5 py-3.5"
          style={{ borderBottom: "1px solid var(--color-line)" }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
            SuperAdmin reads health only. Branch business data stays on each branch.
          </span>
          <RefreshButton onRefresh={handleCheckAll} isFetching={isFetching} />
        </div>

        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 px-6 text-center">
            <Server className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
            <p className="m-0" style={{ fontSize: 14, color: "var(--color-text-secondary)" }}>
              No branches yet
            </p>
            <p className="m-0 max-w-md" style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
              Add each branch with its Tailscale address and the management key from its{" "}
              <span className="font-mono">back/.env</span>.
            </p>
            <Button onClick={handleAdd} className="mt-2">
              <Plus />
              Add branch
            </Button>
          </div>
        ) : (
          <DataTable
            dataSource={branches}
            columns={columns}
            rowKey="branchId"
            loading={isLoading}
            scroll={{ x: 900 }}
          />
        )}
      </div>

      <BranchFormDrawer open={formBranch !== null} branch={formBranch} onClose={handleCloseForm} />
    </div>
  );
};

export default BranchesPage;
