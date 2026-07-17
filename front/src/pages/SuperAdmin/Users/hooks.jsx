import { Button, Dropdown } from "antd";
import { useCallback, useMemo, useState } from "react";
import { Eye, MoreVertical } from "lucide-react";
import { useDebounce } from "../../../hooks/useDebounce";
import { useGetSuperAdminUsers } from "../../../services/requests/superadmin/users";
import { useGetCompanies } from "../../../services/requests/superadmin/companies";
import { decodeHTML } from "../../../utils/decode-html";

// Status dot colors — tokens only, so light/dark both work.
const STATUS_DOT = {
  Active: "var(--color-success)",
  Inactive: "var(--color-text-muted)",
  Suspended: "var(--color-warning)",
  Deleted: "var(--color-error)",
};

export const useUserHooks = () => {
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");

  const debouncedSearch = useDebounce(search, 500);

  // API calls
  const {
    data: apiData,
    isLoading,
    error,
    refetch,
  } = useGetSuperAdminUsers({
    page: currentPage,
    pageSize: pageSize,
    search: debouncedSearch,
    status: statusFilter || undefined,
    companyId: companyFilter || undefined,
  });

  // Get companies for filter dropdown
  const { data: orgsData } = useGetCompanies({ pageSize: 100 });

  // Transform data
  const transformedData = useMemo(() => {
    if (!apiData?.data?.data) return { users: [], pagination: {} };

    const users = apiData.data.data.map((user) => ({
      accountId: user.accountId,
      firstName: user.firstName,
      lastName: user.lastName,
      fullName: `${user.firstName} ${user.lastName}`,
      email: user.email,
      phone: user.phone,
      companyId: user.companyId,
      branchId: user.branchId,
      companyName: user.companyName,
      branchName: user.branchName,
      roleId: user.roleId,
      roleName: user.roleName,
      status: user.status,
      dateCreated: user.dateCreated,
    }));

    return {
      users,
      pagination: apiData.data.pagination || {},
    };
  }, [apiData]);

  // Company options for filter
  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.companyId,
      label: decodeHTML(org.name),
    }));
  }, [orgsData]);

  // Action handlers
  const handleView = useCallback((record) => {
    setViewingUser(record);
  }, []);

  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

  const handleCloseCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(false);
    refetch();
  }, [refetch]);

  const handleCloseViewModal = useCallback(() => {
    setViewingUser(null);
  }, []);

  // ⋮ menu — SuperAdmin users are read-only here (no update/delete endpoint),
  // so the primary action is the only item.
  const getActionItems = useCallback(
    (record) => [
      {
        key: "view",
        label: "View details",
        icon: <Eye className="w-4 h-4" />,
        onClick: () => handleView(record),
      },
    ],
    [handleView],
  );

  // # (mono) · initial-avatar + name · secondary text · status dot · ⋮
  const columns = useMemo(
    () => [
      {
        title: "#",
        key: "index",
        width: 56,
        render: (_, __, index) => (
          <span
            className="font-mono"
            style={{ fontSize: 12, color: "var(--color-text-muted)" }}
          >
            {String((currentPage - 1) * pageSize + index + 1).padStart(2, "0")}
          </span>
        ),
      },
      {
        title: "User",
        key: "user",
        render: (_, record) => {
          const name = decodeHTML(record.fullName) || "";
          const first = decodeHTML(record.firstName) || "";
          const last = decodeHTML(record.lastName) || "";
          const initials =
            `${first.trim().charAt(0)}${last.trim().charAt(0)}`.toUpperCase() ||
            "?";
          return (
            <div className="flex items-center gap-3 min-w-0">
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flex: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-text-secondary)",
                }}
              >
                {initials}
              </span>
              <div className="min-w-0">
                <div
                  className="truncate"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    color: "var(--color-text-dark)",
                  }}
                >
                  {name}
                </div>
                <div
                  className="truncate"
                  style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
                >
                  {decodeHTML(record.email)}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        title: "Company",
        key: "company",
        width: 220,
        render: (_, record) => (
          <div className="min-w-0">
            <div
              className="truncate"
              style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
            >
              {decodeHTML(record.companyName) || "—"}
            </div>
            <div
              className="truncate"
              style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
            >
              {decodeHTML(record.branchName) || "—"}
            </div>
          </div>
        ),
      },
      {
        title: "Role",
        dataIndex: "roleName",
        key: "roleName",
        width: 150,
        ellipsis: true,
        render: (roleName) => (
          <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
            {decodeHTML(roleName) || "—"}
          </span>
        ),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (status) => {
          const active = status === "Active";
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
                  background: STATUS_DOT[status] || "var(--color-text-muted)",
                  boxShadow: active
                    ? "0 0 8px color-mix(in srgb, var(--color-success) 50%, transparent)"
                    : "none",
                }}
              />
              {status}
            </span>
          );
        },
      },
      {
        title: "",
        key: "actions",
        width: 60,
        align: "right",
        render: (_, record) => (
          <Dropdown
            menu={{ items: getActionItems(record) }}
            trigger={["click"]}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreVertical className="w-4 h-4" />}
              className="hover:bg-(--color-surface-sunken)"
            />
          </Dropdown>
        ),
      },
    ],
    [getActionItems, currentPage, pageSize],
  );

  // Pagination handler
  const handleTableChange = useCallback((pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  }, []);

  // Filter handlers
  const handleClearFilters = useCallback(() => {
    setSearch("");
    setStatusFilter("");
    setCompanyFilter("");
    setCurrentPage(1);
  }, []);

  const isSearching = search !== debouncedSearch;

  return {
    data: transformedData.users,
    pagination: {
      current: currentPage,
      pageSize,
      total: transformedData.pagination?.total || 0,
    },
    isLoading,
    error,
    refetch,
    columns,
    handleTableChange,
    isCreateDrawerOpen,
    handleOpenCreateDrawer,
    handleCloseCreateDrawer,
    viewingUser,
    handleCloseViewModal,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    companyFilter,
    setCompanyFilter,
    handleClearFilters,
    isSearching,
    orgOptions,
  };
};
