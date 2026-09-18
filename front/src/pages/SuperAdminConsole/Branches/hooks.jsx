import { useCallback, useMemo, useState } from "react";
import { Building2, Pencil, RefreshCw, Settings2, Trash2, Users } from "lucide-react";
import { useNavigate } from "react-router";

import RowActions from "../../../components/RowActions";
import {
  useBranchHealthChecks,
  useDeleteBranch,
  useGetBranches,
} from "../../../services/requests/superadmin-console/branches";
import { confirm } from "../../../store/confirmStore";
import { StatusCell, WarningsCell } from "./components/cells";

/**
 * Every branch this SuperAdmin manages, with its live health (D10).
 *
 * Each branch is checked on its own, every 30 seconds, through
 * superadmin-server. A branch that is off shows as Offline and never stops the
 * others from loading.
 */

const muted = { fontSize: 12, color: "var(--color-text-muted)" };

export const useBranchesData = () => {
  const [formBranch, setFormBranch] = useState(null); // null = closed, {} = add, row = edit

  const { data, isLoading, isFetching, error, refetch } = useGetBranches();
  const branches = useMemo(() => data?.data?.branches ?? [], [data]);

  const healthQueries = useBranchHealthChecks(branches.map((b) => b.branchId));
  const checks = useMemo(
    () =>
      Object.fromEntries(
        branches.map((b, i) => [b.branchId, healthQueries[i]?.data?.data ?? null])
      ),
    [branches, healthQueries]
  );

  const summary = useMemo(() => {
    const values = branches.map((b) => checks[b.branchId]?.status);
    return {
      total: branches.length,
      online: values.filter((s) => s === "online").length,
      problems: values.filter((s) => s && s !== "online").length,
      warnings: branches.reduce((n, b) => n + (checks[b.branchId]?.warnings?.length ? 1 : 0), 0),
    };
  }, [branches, checks]);

  const deleteMutation = useDeleteBranch();
  const navigate = useNavigate();

  const handleAdd = useCallback(() => setFormBranch({}), []);
  const handleEdit = useCallback((record) => setFormBranch(record), []);
  const handleCloseForm = useCallback(() => setFormBranch(null), []);

  const handleCheckNow = useCallback(
    (record) => {
      const index = branches.findIndex((b) => b.branchId === record.branchId);
      healthQueries[index]?.refetch();
    },
    [branches, healthQueries]
  );

  const handleCheckAll = useCallback(() => {
    refetch();
    healthQueries.forEach((q) => q.refetch());
  }, [refetch, healthQueries]);

  const handleDelete = useCallback(
    async (record) => {
      const ok = await confirm({
        title: "Remove this branch from SuperAdmin?",
        description: `"${record.name}" is removed from this list only. The branch keeps running and its data is not touched. You can add it again with its address and key.`,
        confirmText: "Remove",
        danger: true,
      });
      if (ok) deleteMutation.mutate(record.branchId);
    },
    [deleteMutation]
  );

  const columns = useMemo(
    () => [
      {
        title: "Branch",
        key: "branch",
        ellipsis: true,
        render: (_, record) => {
          const installation = checks[record.branchId]?.health?.installation;
          return (
            <div className="min-w-0">
              <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
                {record.name}
              </div>
              <div className="truncate font-mono" style={muted}>
                {record.baseUrl}
              </div>
              {installation?.branchName && installation.branchName !== record.name && (
                <div className="truncate" style={muted}>
                  Reports itself as {installation.companyName} · {installation.branchName}
                </div>
              )}
            </div>
          );
        },
      },
      {
        title: "Status",
        key: "status",
        width: 230,
        render: (_, record) => <StatusCell check={checks[record.branchId]} />,
      },
      {
        title: "Version",
        key: "version",
        width: 130,
        render: (_, record) => {
          const health = checks[record.branchId]?.health;
          if (!health) return <span style={muted}>—</span>;
          return (
            <div className="min-w-0">
              <div className="font-mono" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
                {health.appVersion}
              </div>
              <div style={muted}>API v{health.manageApiVersion}</div>
            </div>
          );
        },
      },
      {
        title: "Needs attention",
        key: "warnings",
        width: 280,
        render: (_, record) => <WarningsCell check={checks[record.branchId]} />,
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) => (
          <RowActions
            items={[
              {
                key: "check",
                label: "Check now",
                icon: <RefreshCw className="w-4 h-4" />,
                onClick: () => handleCheckNow(record),
              },
              {
                key: "company",
                label: "Company profile",
                icon: <Building2 className="w-4 h-4" />,
                onClick: () => navigate(`/superadmin/company-profile?branch=${record.branchId}`),
              },
              {
                key: "users",
                label: "Users",
                icon: <Users className="w-4 h-4" />,
                onClick: () => navigate(`/superadmin/users?branch=${record.branchId}`),
              },
              {
                key: "system",
                label: "System settings",
                icon: <Settings2 className="w-4 h-4" />,
                onClick: () => navigate(`/superadmin/system-settings?branch=${record.branchId}`),
              },
              {
                key: "edit",
                label: "Edit connection",
                icon: <Pencil className="w-4 h-4" />,
                onClick: () => handleEdit(record),
              },
              { type: "divider" },
              {
                key: "remove",
                label: "Remove from SuperAdmin",
                icon: <Trash2 className="w-4 h-4" />,
                danger: true,
                onClick: () => handleDelete(record),
              },
            ]}
          />
        ),
      },
    ],
    [checks, handleCheckNow, handleEdit, handleDelete, navigate]
  );

  return {
    branches,
    summary,
    columns,
    isLoading,
    isFetching: isFetching || healthQueries.some((q) => q.isFetching),
    error,
    formBranch,
    handleAdd,
    handleCloseForm,
    handleCheckAll,
  };
};
