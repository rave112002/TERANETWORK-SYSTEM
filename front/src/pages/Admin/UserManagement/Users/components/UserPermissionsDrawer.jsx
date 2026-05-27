import { useState, useEffect } from "react";
import { Table, Select, Button, Space, message, Spin, Tag, Alert } from "antd";
import { Shield, Key, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserPermissions,
  bulkUpdateUserPermissions,
} from "../../../../../services/api/admin/user-permissions";

const { Option } = Select;

const UserPermissionsDrawer = ({ user, onClose }) => {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch user permissions
  const { data, isLoading, error } = useQuery({
    queryKey: ["userPermissions", user?.accountId],
    queryFn: () => getUserPermissions(user.accountId),
    enabled: !!user?.accountId,
  });

  // Bulk update mutation
  const updateMutation = useMutation({
    mutationFn: ({ accountId, permissions }) =>
      bulkUpdateUserPermissions(accountId, permissions),
    onSuccess: () => {
      message.success("User permissions updated successfully");
      setHasChanges(false);
      queryClient.invalidateQueries(["userPermissions", user.accountId]);
      queryClient.invalidateQueries(["users"]);
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to update permissions",
      );
    },
  });

  useEffect(() => {
    if (data) {
      // Merge role permissions with user overrides
      const rolePerms = data?.data?.rolePermissions || [];
      const userPerms = data?.data?.userPermissions || [];

      // If no role permissions, show empty state
      if (rolePerms.length === 0) {
        setPermissions([]);
        return;
      }

      // Create a map of user overrides
      const userPermMap = new Map(
        userPerms.map((p) => [p.permissionId, p.accessLevel]),
      );

      // Merge permissions
      const merged = rolePerms.map((rolePerm) => ({
        permissionId: rolePerm.permissionId,
        module: rolePerm.module,
        submodule: rolePerm.submodule,
        description: rolePerm.description,
        roleAccessLevel: rolePerm.accessLevel,
        userAccessLevel: userPermMap.get(rolePerm.permissionId) || null,
        currentAccessLevel:
          userPermMap.get(rolePerm.permissionId) || rolePerm.accessLevel,
        hasOverride: userPermMap.has(rolePerm.permissionId),
      }));

      setPermissions(merged);
    }
  }, [data]);

  const handleAccessLevelChange = (permissionId, newAccessLevel) => {
    setPermissions((prev) =>
      prev.map((perm) => {
        if (perm.permissionId === permissionId) {
          const isOverride = newAccessLevel !== perm.roleAccessLevel;
          return {
            ...perm,
            userAccessLevel: isOverride ? newAccessLevel : null,
            currentAccessLevel: newAccessLevel,
            hasOverride: isOverride,
          };
        }
        return perm;
      }),
    );
    setHasChanges(true);
  };

  const handleRemoveOverride = (permissionId) => {
    setPermissions((prev) =>
      prev.map((perm) => {
        if (perm.permissionId === permissionId) {
          return {
            ...perm,
            userAccessLevel: null,
            currentAccessLevel: perm.roleAccessLevel,
            hasOverride: false,
          };
        }
        return perm;
      }),
    );
    setHasChanges(true);
  };

  const handleSave = () => {
    // Only send permissions that have overrides
    const overrides = permissions
      .filter((p) => p.hasOverride)
      .map((p) => ({
        permissionId: p.permissionId,
        accessLevel: p.userAccessLevel,
      }));

    updateMutation.mutate({
      accountId: user.accountId,
      permissions: overrides,
    });
  };

  const handleReset = () => {
    if (data) {
      const rolePerms = data?.data?.rolePermissions || [];
      const userPerms = data?.data?.userPermissions || [];
      const userPermMap = new Map(
        userPerms.map((p) => [p.permissionId, p.accessLevel]),
      );

      const merged = rolePerms.map((rolePerm) => ({
        permissionId: rolePerm.permissionId,
        module: rolePerm.module,
        submodule: rolePerm.submodule,
        description: rolePerm.description,
        roleAccessLevel: rolePerm.accessLevel,
        userAccessLevel: userPermMap.get(rolePerm.permissionId) || null,
        currentAccessLevel:
          userPermMap.get(rolePerm.permissionId) || rolePerm.accessLevel,
        hasOverride: userPermMap.has(rolePerm.permissionId),
      }));

      setPermissions(merged);
      setHasChanges(false);
    }
  };

  const getAccessLevelColor = (level) => {
    switch (level) {
      case "write":
        return "green";
      case "read":
        return "blue";
      case "none":
        return "default";
      default:
        return "default";
    }
  };

  const columns = [
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      width: 150,
      render: (text) => (
        <div className="font-medium text-gray-900 capitalize">{text}</div>
      ),
    },
    {
      title: "Submodule",
      dataIndex: "submodule",
      key: "submodule",
      width: 150,
      render: (text) => (
        <div className="text-gray-600 capitalize">{text || "-"}</div>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
    },
    {
      title: "Role Permission",
      dataIndex: "roleAccessLevel",
      key: "roleAccessLevel",
      width: 150,
      align: "center",
      render: (level) => (
        <Tag color={getAccessLevelColor(level)} className="uppercase">
          {level}
        </Tag>
      ),
    },
    {
      title: "User Override",
      key: "userOverride",
      width: 200,
      align: "center",
      render: (_, record) => (
        <Space>
          <Select
            value={record.currentAccessLevel}
            onChange={(value) =>
              handleAccessLevelChange(record.permissionId, value)
            }
            style={{ width: 100 }}
            size="small"
          >
            <Option value="none">None</Option>
            <Option value="read">Read</Option>
            <Option value="write">Write</Option>
          </Select>
          {record.hasOverride && (
            <Button
              type="link"
              size="small"
              danger
              onClick={() => handleRemoveOverride(record.permissionId)}
            >
              Reset
            </Button>
          )}
        </Space>
      ),
    },
    {
      title: "Status",
      key: "status",
      width: 100,
      align: "center",
      render: (_, record) =>
        record.hasOverride ? (
          <Tag color="orange" icon={<AlertCircle className="w-3 h-3" />}>
            Override
          </Tag>
        ) : (
          <Tag color="default">Default</Tag>
        ),
    },
  ];

  if (error) {
    return (
      <div className="p-6">
        <Alert
          message="Error Loading Permissions"
          description={
            error.response?.data?.message ||
            "Failed to load user permissions. Please try again."
          }
          type="error"
          showIcon
        />
      </div>
    );
  }

  // Check if user has no role assigned
  const hasNoRole = !isLoading && data && !data?.data?.roleId;

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2.5 bg-linear-to-br from-purple-500 to-indigo-500 rounded-xl">
            <Key className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">
              Manage Permissions
            </h2>
            <p className="text-sm text-gray-500">
              {user?.firstName} {user?.lastName}
            </p>
          </div>
        </div>

        {data?.data?.roleId && (
          <div className="mt-4 p-3 bg-blue-50 rounded-lg flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <span className="text-sm text-blue-900">
              <strong>Role:</strong> {data.data.roleName || "No Role"}
            </span>
          </div>
        )}

        {!hasNoRole && (
          <Alert
            message="Permission Overrides"
            description="User-specific permissions will override role permissions. Changes only affect this user."
            type="info"
            showIcon
            className="mt-4"
          />
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spin size="large" tip="Loading permissions..." />
          </div>
        ) : hasNoRole ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <Shield className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Role Assigned
            </h3>
            <p className="text-gray-500 max-w-md mb-4">
              This user has no role assigned. Please assign a role to the user
              first before managing permissions.
            </p>
            <Alert
              message="How to assign a role"
              description="Edit the user and select a role from the Role dropdown in the user form."
              type="warning"
              showIcon
              className="max-w-md"
            />
          </div>
        ) : permissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="p-4 bg-gray-100 rounded-full mb-4">
              <AlertCircle className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Permissions Available
            </h3>
            <p className="text-gray-500 max-w-md">
              The assigned role has no permissions configured. Please configure
              permissions for the role first.
            </p>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={permissions}
            rowKey="permissionId"
            pagination={false}
            scroll={{ y: "calc(100vh - 400px)" }}
            size="small"
          />
        )}
      </div>

      {/* Footer */}
      <div className="p-6 border-t border-gray-200 bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {hasNoRole
              ? "No role assigned"
              : `${permissions.filter((p) => p.hasOverride).length} override(s)`}
          </div>
          <Space>
            <Button onClick={onClose} disabled={updateMutation.isPending}>
              {hasNoRole ? "Close" : "Cancel"}
            </Button>
            {!hasNoRole && (
              <>
                <Button
                  onClick={handleReset}
                  disabled={!hasChanges || updateMutation.isPending}
                >
                  Reset Changes
                </Button>
                <Button
                  type="primary"
                  onClick={handleSave}
                  loading={updateMutation.isPending}
                  disabled={!hasChanges}
                  style={{
                    background:
                      "linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)",
                    border: "none",
                  }}
                >
                  Save Permissions
                </Button>
              </>
            )}
          </Space>
        </div>
      </div>
    </div>
  );
};

export default UserPermissionsDrawer;
