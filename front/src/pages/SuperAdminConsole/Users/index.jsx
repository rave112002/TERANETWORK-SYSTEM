import { Link } from "react-router";
import { CircleAlert, Server, TriangleAlert, UserPlus } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

import { useBranchUsersData } from "./hooks";
import CreateLoginDrawer from "./components/CreateLoginDrawer";
import ResetPasswordDrawer from "./components/ResetPasswordDrawer";
import BranchPicker from "../components/BranchPicker";
import DataTable from "../../../components/DataTable";
import PageHeader from "../../../components/PageHeader";
import RefreshButton from "../../../components/RefreshButton";

const cardStyle = { border: "1px solid var(--color-line)", borderRadius: "var(--radius-card)" };

const UsersPage = () => {
  const {
    branches,
    branch,
    selectBranch,
    users,
    hasOwner,
    columns,
    isLoading,
    isFetching,
    loadError,
    refetch,
    createOpen,
    handleOpenCreate,
    handleCloseCreate,
    resetUser,
    handleCloseReset,
  } = useBranchUsersData();

  const noBranches = !isLoading && branches.length === 0;

  return (
    <div className="p-8 space-y-5">
      <PageHeader
        title="Users"
        subtitle="Owner and Admin logins for a branch's Admin portal. Staff logins are managed on the branch."
        actions={
          branch &&
          !loadError && (
            <Button onClick={handleOpenCreate}>
              <UserPlus />
              Add login
            </Button>
          )
        }
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <BranchPicker branches={branches} branch={branch} onChange={selectBranch} />
        {branch && <RefreshButton onRefresh={refetch} isFetching={isFetching} />}
      </div>

      {noBranches ? (
        <div className="bg-surface flex flex-col items-center gap-3 py-14 px-6 text-center" style={cardStyle}>
          <Server className="w-8 h-8" style={{ color: "var(--color-text-muted)" }} />
          <p className="m-0" style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            Add a branch first.
          </p>
          <Button asChild variant="outline">
            <Link to="/superadmin/branches">Go to Branches</Link>
          </Button>
        </div>
      ) : loadError ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Could not load {branch?.name ?? "the branch"}&apos;s logins</AlertTitle>
          <AlertDescription>{loadError.response?.data?.message || loadError.message}</AlertDescription>
        </Alert>
      ) : (
        <>
          {!isLoading && !hasOwner && (
            <Alert>
              <TriangleAlert style={{ color: "var(--color-warning)" }} />
              <AlertTitle>{branch?.name} has no Owner login</AlertTitle>
              <AlertDescription>
                Nobody can run this branch&apos;s Admin portal with full access. Add an Owner login.
              </AlertDescription>
            </Alert>
          )}
          <div className="bg-surface overflow-hidden" style={cardStyle}>
            <DataTable dataSource={users} columns={columns} rowKey="accountId" loading={isLoading} scroll={{ x: 720 }} />
          </div>
        </>
      )}

      <CreateLoginDrawer open={createOpen} onClose={handleCloseCreate} branch={branch} hasOwner={hasOwner} />
      <ResetPasswordDrawer open={!!resetUser} onClose={handleCloseReset} branch={branch} user={resetUser} />
    </div>
  );
};

export default UsersPage;
