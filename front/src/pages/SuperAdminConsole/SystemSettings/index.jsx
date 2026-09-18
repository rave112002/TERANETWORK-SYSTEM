import { Link } from "react-router";
import { CircleAlert, Server, ShieldAlert } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { useBranchSystemSettingsData } from "./hooks";
import BranchPicker from "../components/BranchPicker";
import PageHeader from "../../../components/PageHeader";
import RefreshButton from "../../../components/RefreshButton";
import Spinner from "../../../components/Spinner";
import SystemSettingsPanel from "../../../components/system/SystemSettingsPanel";

const cardStyle = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-line)",
  borderRadius: "var(--radius-card)",
};

const SystemSettingsPage = () => {
  const {
    branches,
    branch,
    selectBranch,
    settings,
    isLoading,
    isFetching,
    loadError,
    refetch,
    isSaving,
    handleDryRunChange,
    handleSave,
  } = useBranchSystemSettingsData();

  const noBranches = !isLoading && branches.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="System Settings"
        subtitle="Dry-run, billing schedule and billing rules for one branch. Same rules as the branch's own System page."
      />

      <div className="flex items-center justify-between gap-3 flex-wrap max-w-4xl">
        <BranchPicker branches={branches} branch={branch} onChange={selectBranch} />
        {branch && <RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      </div>

      {noBranches ? (
        <div className="max-w-4xl flex flex-col items-center gap-3 py-14 px-6 text-center" style={cardStyle}>
          <Server className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            Add a branch first.
          </p>
          <Button asChild variant="outline">
            <Link to="/superadmin/branches">Go to Branches</Link>
          </Button>
        </div>
      ) : loadError ? (
        <Alert variant="destructive" className="max-w-4xl">
          <CircleAlert />
          <AlertTitle>Could not load {branch?.name ?? "the branch"}&apos;s settings</AlertTitle>
          <AlertDescription>{loadError.response?.data?.message || loadError.message}</AlertDescription>
        </Alert>
      ) : (
        <>
          {settings?.DRY_RUN && (
            <Alert className="max-w-4xl">
              <ShieldAlert />
              <AlertTitle>Dry-run is on at {branch?.name}</AlertTitle>
              <AlertDescription>
                Device commands there are being logged, not executed. Nobody at this branch is being
                disconnected or reconnected while this is on.
              </AlertDescription>
            </Alert>
          )}
          <div className="max-w-4xl" style={cardStyle}>
            {isLoading || !settings ? (
              <div className="flex items-center justify-center py-20">
                <Spinner size="large" />
              </div>
            ) : (
              <SystemSettingsPanel
                settings={settings}
                canWrite
                isSaving={isSaving}
                onDryRunChange={handleDryRunChange}
                onSave={handleSave}
                footerNote={
                  <>
                    Saves to <strong>{branch?.name}</strong> only.
                  </>
                }
              />
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default SystemSettingsPage;
