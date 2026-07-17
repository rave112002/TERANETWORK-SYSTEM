import { useState, useEffect } from "react";
import { Alert, Button, Drawer, Select, Space, Spin, Table, message } from "antd";
import { AlertCircle, Key, Shield, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getUserPermissions,
  bulkUpdateUserPermissions,
} from "../../../../../services/api/admin/user-permissions";

const { Option } = Select;

// Monochrome chip — access levels read as plain labels, the accent is reserved
// for the "Override" signal.
const Chip = ({ children, accent }) => (
  <span
    className="inline-flex items-center gap-1.5 uppercase"
    style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.04em",
      padding: "2px 8px",
      borderRadius: 6,
      background: "var(--color-surface-sunken)",
      border: "1px solid var(--color-line)",
      color: accent ? "var(--color-link)" : "var(--color-text-secondary)",
    }}
  >
    {children}
  </span>
);

// Rebuild the merged permission rows from a fetched payload — role permissions
// with the user's overrides layered on top.
const mergePermissions = (data) => {
  const rolePerms = data?.data?.rolePermissions || [];
  const userPerms = data?.data?.userPermissions || [];

  if (rolePerms.length === 0) return [];

  const userPermMap = new Map(
    userPerms.map((p) => [p.permissionId, p.accessLevel]),
  );

  return rolePerms.map((rolePerm) => ({
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
};

const UserPermissionsDrawer = ({ open, user, onClose }) => {
  const queryClient = useQueryClient();
  const [permissions, setPermissions] = useState([]);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch user permissions
  const { data, isLoading, error } = useQuery({
    queryKey: ["userPermissions", user?.accountId],
    queryFn: () => getUserPermissions(user.accountId),
    enabled: open && !!user?.accountId,
  });

  // Bulk update mutation
  const updateMutation = useMutation({
    mutationFn: ({ accountId, permissions }) =>
      bulkUpdateUserPermissions(accountId, permissions),
    onSuccess: () => {
      message.success("User permissions updated successfully");
      setHasChanges(false);
      queryClient.invalidateQueries({
        queryKey: ["userPermissions", user.accountId],
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to update permissions",
      );
    },
  });

  useEffect(() => {
    if (data) setPermissions(mergePermissions(data));
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
      setPermissions(mergePermissions(data));
      setHasChanges(false);
    }
  };

  const columns = [
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      width: 140,
      render: (text) => (
        <span
          className="capitalize"
          style={{
            fontSize: 13.5,
            fontWeight: 500,
            color: "var(--color-text-dark)",
          }}
        >
          {text}
        </span>
      ),
    },
    {
      title: "Submodule",
      dataIndex: "submodule",
      key: "submodule",
      width: 140,
      render: (text) => (
        <span
          className="capitalize"
          style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
        >
          {text || "-"}
        </span>
      ),
    },
    {
      title: "Description",
      dataIndex: "description",
      key: "description",
      ellipsis: true,
      render: (d) => (
        <span style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}>
          {d}
        </span>
      ),
    },
    {
      title: "Role permission",
      dataIndex: "roleAccessLevel",
      key: "roleAccessLevel",
      width: 140,
      align: "center",
      render: (level) => <Chip>{level}</Chip>,
    },
    {
      title: "User override",
      key: "userOverride",
      width: 190,
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
      width: 110,
      align: "center",
      render: (_, record) =>
        record.hasOverride ? <Chip accent>Override</Chip> : <Chip>Default</Chip>,
    },
  ];

  // Check if user has no role assigned
  const hasNoRole = !isLoading && data && !data?.data?.roleId;
  const overrideCount = permissions.filter((p) => p.hasOverride).length;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={1000}
      closable={false}
      styles={{ body: { padding: 24 } }}
    >
      {/* Header — accent chip + title + subtitle + bordered X */}
      <div className="flex items-start justify-between gap-3 mb-7">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
            <Key className="w-[22px] h-[22px] text-white" />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 font-semibold leading-tight truncate"
              style={{ fontSize: 19, color: "var(--color-text-dark)" }}
            >
              Manage permissions
            </h2>
            <p
              className="m-0 mt-0.5 truncate"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {user
                ? `Access levels for ${user.firstName} ${user.lastName}`
                : "Configure access levels for this user"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          className="inline-flex items-center justify-center shrink-0 transition-colors hover:bg-(--color-surface-sunken)"
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "1px solid var(--color-line)",
            color: "var(--color-text-secondary)",
          }}
        >
          <X className="w-[18px] h-[18px]" />
        </button>
      </div>

      {error ? (
        <Alert
          message="Error loading permissions"
          description={
            error.response?.data?.message ||
            "Failed to load user permissions. Please try again."
          }
          type="error"
          showIcon
        />
      ) : (
        <>
          {/* Assigned role well */}
          {data?.data?.roleId && (
            <div
              className="flex items-center gap-2 p-3 mb-4"
              style={{
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
                borderRadius: 9,
              }}
            >
              <Shield
                className="w-4 h-4 shrink-0"
                style={{ color: "var(--color-text-muted)" }}
              />
              <span
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                Role:{" "}
                <span
                  style={{
                    fontWeight: 500,
                    color: "var(--color-text-dark)",
                  }}
                >
                  {data.data.roleName || "No Role"}
                </span>
              </span>
            </div>
          )}

          {!hasNoRole && (
            <Alert
              message="Permission overrides"
              description="User-specific permissions will override role permissions. Changes only affect this user."
              type="info"
              showIcon
              className="mb-5"
            />
          )}

          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Spin size="large" />
            </div>
          ) : hasNoRole ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <span
                className="inline-flex items-center justify-center mb-4"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                }}
              >
                <Shield
                  className="w-6 h-6"
                  style={{ color: "var(--color-text-muted)" }}
                />
              </span>
              <h3
                className="m-0 mb-2 font-semibold"
                style={{ fontSize: 16, color: "var(--color-text-dark)" }}
              >
                No role assigned
              </h3>
              <p
                className="m-0 mb-4 max-w-md"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
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
              <span
                className="inline-flex items-center justify-center mb-4"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 14,
                  background: "var(--color-surface-sunken)",
                  border: "1px solid var(--color-line)",
                }}
              >
                <AlertCircle
                  className="w-6 h-6"
                  style={{ color: "var(--color-text-muted)" }}
                />
              </span>
              <h3
                className="m-0 mb-2 font-semibold"
                style={{ fontSize: 16, color: "var(--color-text-dark)" }}
              >
                No permissions available
              </h3>
              <p
                className="m-0 max-w-md"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                The assigned role has no permissions configured. Please configure
                permissions for the role first.
              </p>
            </div>
          ) : (
            <div
              className="overflow-hidden"
              style={{
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-card)",
              }}
            >
              <Table
                columns={columns}
                dataSource={permissions}
                rowKey="permissionId"
                pagination={false}
                scroll={{ x: 820, y: "calc(100vh - 460px)" }}
                size="small"
                className="border-none"
              />
            </div>
          )}
        </>
      )}

      {/* Footer */}
      <div
        className="mt-8 pt-5 flex items-center justify-between gap-3 flex-wrap"
        style={{
          borderTop: "1px solid var(--color-line)",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <span className="text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
          {hasNoRole
            ? "No role assigned"
            : `${overrideCount} override${overrideCount === 1 ? "" : "s"}`}
        </span>
        <div className="flex items-center gap-3">
          <Button
            onClick={onClose}
            size="large"
            disabled={updateMutation.isPending}
          >
            {hasNoRole ? "Close" : "Cancel"}
          </Button>
          {!hasNoRole && (
            <>
              <Button
                onClick={handleReset}
                size="large"
                disabled={!hasChanges || updateMutation.isPending}
              >
                Reset changes
              </Button>
              <Button
                type="primary"
                onClick={handleSave}
                loading={updateMutation.isPending}
                disabled={!hasChanges}
                size="large"
              >
                Save permissions
              </Button>
            </>
          )}
        </div>
      </div>
    </Drawer>
  );
};

export default UserPermissionsDrawer;
