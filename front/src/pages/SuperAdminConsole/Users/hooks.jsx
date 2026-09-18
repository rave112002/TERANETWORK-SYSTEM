import { useCallback, useMemo, useState } from "react";
import { KeyRound, Power, PowerOff } from "lucide-react";
import dayjs from "dayjs";

import RowActions from "../../../components/RowActions";
import {
  useGetBranchUsers,
  useSetBranchUserStatus,
} from "../../../services/requests/superadmin-console/users";
import { confirm } from "../../../store/confirmStore";
import { decodeHTML } from "../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../utils/phoneFormat";
import { useSelectedBranch } from "../components/useSelectedBranch";

/**
 * One branch's logins, read from and changed on that branch (D10).
 *
 * SuperAdmin creates Owner and Admin logins and recovers any login (reset the
 * password, switch it off or on). It does not edit staff details or roles;
 * that stays in the branch's own Admin portal.
 */

const muted = { fontSize: 12, color: "var(--color-text-muted)" };

const ROLE_COLOR = {
  Owner: "var(--color-link)",
  Admin: "var(--color-text-secondary)",
};

const STATUS_COLOR = {
  Active: "var(--color-success)",
  Inactive: "var(--color-text-muted)",
  Suspended: "var(--color-warning)",
};

export const useBranchUsersData = () => {
  const { branches, branch, selectBranch, isLoading: branchesLoading, error: branchesError } =
    useSelectedBranch();
  const branchId = branch?.branchId;
  const branchName = branch?.name;

  const { data, isLoading, isFetching, error, refetch } = useGetBranchUsers(branchId);
  const users = useMemo(() => data?.data?.users ?? [], [data]);
  const hasOwner = users.some((u) => u.roleName === "Owner");

  const [createOpen, setCreateOpen] = useState(false);
  const [resetUser, setResetUser] = useState(null);
  const statusMutation = useSetBranchUserStatus();

  const handleToggleStatus = useCallback(
    async (user) => {
      const turningOff = user.status === "Active";
      const ok = await confirm({
        title: turningOff ? "Deactivate this login?" : "Reactivate this login?",
        description: turningOff
          ? `${user.email} can no longer log in to ${branchName} and is signed out everywhere. Their records stay. You can reactivate it later.`
          : `${user.email} can log in to ${branchName} again with their existing password.`,
        confirmText: turningOff ? "Deactivate" : "Reactivate",
        danger: turningOff,
      });
      if (ok) {
        statusMutation.mutate({
          branchId,
          accountId: user.accountId,
          status: turningOff ? "Inactive" : "Active",
        });
      }
    },
    [branchId, branchName, statusMutation]
  );

  const columns = useMemo(
    () => [
      {
        title: "Name",
        key: "name",
        ellipsis: true,
        render: (_, u) => (
          <div className="min-w-0">
            <div className="truncate" style={{ fontSize: 13.5, color: "var(--color-text-dark)" }}>
              {decodeHTML(u.firstName)} {decodeHTML(u.lastName)}
            </div>
            <div className="truncate" style={muted}>
              {u.email || "—"}
              {u.phone ? ` · ${formatPhoneDisplay(u.phone)}` : ""}
            </div>
          </div>
        ),
      },
      {
        title: "Role",
        key: "role",
        width: 150,
        render: (_, u) => (
          <span
            style={{
              fontSize: 13,
              color: ROLE_COLOR[u.roleName] ?? "var(--color-text-secondary)",
              fontWeight: u.roleName === "Owner" ? 600 : 400,
            }}
          >
            {u.roleName || "—"}
          </span>
        ),
      },
      {
        title: "Status",
        key: "status",
        width: 130,
        render: (_, u) => (
          <span className="inline-flex items-center gap-2" style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: STATUS_COLOR[u.status] }} />
            {u.status}
          </span>
        ),
      },
      {
        title: "Created",
        key: "dateCreated",
        width: 140,
        render: (_, u) => <span style={muted}>{dayjs(u.dateCreated).format("MMM D, YYYY")}</span>,
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, u) => (
          <RowActions
            items={[
              {
                key: "reset",
                label: "Reset password",
                icon: <KeyRound className="w-4 h-4" />,
                onClick: () => setResetUser(u),
              },
              { type: "divider" },
              u.status === "Active"
                ? {
                    key: "off",
                    label: "Deactivate login",
                    icon: <PowerOff className="w-4 h-4" />,
                    danger: true,
                    onClick: () => handleToggleStatus(u),
                  }
                : {
                    key: "on",
                    label: "Reactivate login",
                    icon: <Power className="w-4 h-4" />,
                    onClick: () => handleToggleStatus(u),
                  },
            ]}
          />
        ),
      },
    ],
    [handleToggleStatus]
  );

  return {
    branches,
    branch,
    selectBranch,
    users,
    hasOwner,
    columns,
    isLoading: branchesLoading || (!!branchId && isLoading),
    isFetching,
    loadError: branchesError || error,
    refetch,
    createOpen,
    handleOpenCreate: () => setCreateOpen(true),
    handleCloseCreate: () => setCreateOpen(false),
    resetUser,
    handleCloseReset: () => setResetUser(null),
  };
};
