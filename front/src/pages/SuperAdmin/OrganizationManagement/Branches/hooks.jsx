import { Button, Dropdown, Tag, Avatar } from "antd";
import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "../../../../hooks/useDebounce";
import {
  MoreVertical,
  Eye,
  Edit,
  Trash2,
  MapPin,
  Building2,
} from "lucide-react";
import {
  useGetBranches,
  useDeleteBranch,
} from "../../../../services/requests/superadmin/branches";
import { useGetOrganizations } from "../../../../services/requests/superadmin/organizations";

export const useBranchHooks = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isCreateDrawerOpen, setIsCreateDrawerOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [brandFilter, setBrandFilter] = useState("");

  const debouncedSearch = useDebounce(search, 500);

  const {
    data: apiData,
    isLoading,
    error,
    refetch,
  } = useGetBranches({
    page: currentPage,
    pageSize,
    search: debouncedSearch,
    status: statusFilter || undefined,
    brandId: brandFilter || undefined,
  });

  const deleteMutation = useDeleteBranch();

  // Get organizations for filter
  const { data: orgsData } = useGetOrganizations({ pageSize: 100 });

  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.brandId,
      label: org.name,
    }));
  }, [orgsData]);

  const transformedData = useMemo(() => {
    if (!apiData?.data?.data) return { branches: [], pagination: {} };

    const branches = apiData.data.data.map((branch) => ({
      branchId: branch.branchId,
      brandId: branch.brandId,
      name: branch.name,
      email: branch.email,
      phone: branch.phone,
      address: branch.address,
      isMainBranch: branch.isMainBranch,
      status: branch.status,
      dateCreated: branch.dateCreated,
      brandName: branch.brandName,
    }));

    return {
      branches,
      pagination: apiData.data.pagination || {},
    };
  }, [apiData]);

  const handleEdit = useCallback((record) => {
    setEditingBranch(record);
  }, []);

  const handleDelete = useCallback(
    async (record) => {
      await deleteMutation.mutateAsync(record.branchId);
    },
    [deleteMutation],
  );

  const handleOpenCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(true);
  }, []);

  const handleCloseCreateDrawer = useCallback(() => {
    setIsCreateDrawerOpen(false);
  }, []);

  const handleCloseEditDrawer = useCallback(() => {
    setEditingBranch(null);
  }, []);

  const getActionItems = useCallback(
    (record) => [
      {
        key: "edit",
        label: "Edit Branch",
        icon: <Edit className="w-4 h-4" />,
        onClick: () => handleEdit(record),
      },
      { type: "divider" },
      {
        key: "delete",
        label: "Delete Branch",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => handleDelete(record),
        disabled: record.isMainBranch,
      },
    ],
    [handleEdit, handleDelete],
  );

  const columns = useMemo(
    () => [
      {
        title: "Branch",
        key: "name",
        fixed: "left",
        width: 250,
        render: (_, record) => (
          <div className="flex items-center gap-3">
            <Avatar
              size={40}
              icon={<MapPin className="w-5 h-5" />}
              className="bg-secondary-pale text-secondary-color"
            />
            <div className="min-w-0">
              <div className="font-semibold text-gray-900 truncate">
                {record.name}
                {record.isMainBranch ? (
                  <Tag color="blue" className="ml-2">
                    Main
                  </Tag>
                ) : null}
              </div>
              <div className="text-sm text-gray-500 truncate">
                {record.address || "—"}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: "Organization",
        dataIndex: "brandName",
        key: "brandName",
        width: 180,
        render: (text) => (
          <div className="flex items-center gap-1">
            <Building2 className="w-3.5 h-3.5 text-gray-400" />
            <span>{text || "—"}</span>
          </div>
        ),
      },
      {
        title: "Contact",
        key: "contact",
        width: 200,
        render: (_, record) => (
          <div>
            <div className="text-sm text-gray-900">{record.email || "—"}</div>
            <div className="text-sm text-gray-500">{record.phone || "—"}</div>
          </div>
        ),
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

  const handleTableChange = useCallback((pagination) => {
    setCurrentPage(pagination.current);
    setPageSize(pagination.pageSize);
  }, []);

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
    editingBranch,
    handleCloseEditDrawer,
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
