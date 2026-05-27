import { Button, Dropdown, Tag, Avatar } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "../../../hooks/useDebounce";
import { MoreVertical, Eye, UserPlus, Building2 } from "lucide-react";
import { useGetSuperAdminUsers } from "../../../services/requests/superadmin/users";
import { useGetOrganizations } from "../../../services/requests/superadmin/organizations";

export const useUserHooks = () => {
  // State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [viewingUser, setViewingUser] = useState(null);

  // Filter state
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

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
    brandId: brandFilter || undefined,
  });

  // Get organizations for filter dropdown
  const { data: orgsData } = useGetOrganizations({ pageSize: 100 });

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
      brandId: user.brandId,
      branchId: user.branchId,
      brandName: user.brandName,
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

  // Organization options for filter
  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.brandId,
      label: org.name,
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

  // Dropdown menu items
  const getActionItems = useCallback(
    (record) => [
      {
        key: "view",
        label: "View Details",
        icon: <Eye className="w-4 h-4" />,
        onClick: () => handleView(record),
      },
    ],
    [handleView],
  );

  // Columns
  const columns = useMemo(
    () => [
      {
        title: "User",
        key: "user",
        fixed: "left",
        width: 250,
        render: (_, record) => (
          <div className="flex items-center gap-3">
            <Avatar size={40} className="bg-primary-pale text-primary-color">
              {record.firstName?.[0]}
              {record.lastName?.[0]}
            </Avatar>
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {record.fullName}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {record.email}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Organization",
        key: "organization",
        width: 200,
        render: (_, record) => (
          <div>
            <div className="font-medium text-gray-900 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-gray-400" />
              {record.brandName}
            </div>
            <div className="text-sm text-gray-500">{record.branchName}</div>
          </div>
        ),
      },
      {
        title: "Role",
        dataIndex: "roleName",
        key: "roleName",
        width: 120,
        render: (roleName) => <Tag color="purple">{roleName || "—"}</Tag>,
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (status) => {
          const colors = {
            Active: "success",
            Inactive: "default",
            Suspended: "warning",
            Deleted: "error",
          };
          return <Tag color={colors[status] || "default"}>{status}</Tag>;
        },
      },
      {
        title: "Actions",
        key: "actions",
        fixed: "right",
        width: 70,
        render: (_, record) => (
          <Dropdown
            menu={{ items: getActionItems(record) }}
            trigger={["click"]}
          >
            <Button
              type="text"
              icon={<MoreVertical className="w-4 h-4" />}
              className="hover:bg-gray-100"
            />
          </Dropdown>
        ),
      },
    ],
    [getActionItems],
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
    setBrandFilter("");
    setCurrentPage(1);
  }, []);

  const isSearching = search !== debouncedSearch;

  return {
    data: transformedData,
    isLoading,
    error,
    refetch,
    columns,
    currentPage,
    pageSize,
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
    brandFilter,
    setBrandFilter,
    handleClearFilters,
    isSearching,
    orgOptions,
  };
};
