import { useState, useEffect, useMemo } from "react";
import {
  Button,
  Collapse,
  Checkbox,
  Select,
  Space,
  message,
  Spin,
  Alert,
} from "antd";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getPermissions } from "../../../../../services/api/admin/permissions";
import {
  getRolePermissions,
  assignPermissions,
} from "../../../../../services/api/admin/roles";

const { Panel } = Collapse;

const PermissionsDrawer = ({ role, onClose }) => {
  const queryClient = useQueryClient();
  const [selectedPermissions, setSelectedPermissions] = useState({});

  // Fetch all permissions
  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => getPermissions(),
  });

  // Fetch role permissions
  const { data: rolePermissionsData, isLoading: rolePermissionsLoading } =
    useQuery({
      queryKey: ["rolePermissions", role?.roleId],
      queryFn: () => getRolePermissions(role.roleId),
      enabled: !!role?.roleId,
    });

  useEffect(() => {
    if (rolePermissionsData?.data?.permissions) {
      const permissions = {};
      rolePermissionsData.data.permissions.forEach((perm) => {
        permissions[perm.permissionId] = perm.accessLevel || "write";
      });
      setSelectedPermissions(permissions);
    }
  }, [rolePermissionsData]);

  const saveMutation = useMutation({
    mutationFn: (permissions) => assignPermissions(role.roleId, permissions),
    onSuccess: () => {
      message.success("Permissions updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["rolePermissions", role.roleId],
      });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (error) => {
      message.error(
        error.response?.data?.message || "Failed to update permissions",
      );
    },
  });

  const handlePermissionChange = (permissionId, checked) => {
    setSelectedPermissions((prev) => {
      const newPermissions = { ...prev };
      if (checked) {
        newPermissions[permissionId] = "read";
      } else {
        delete newPermissions[permissionId];
      }
      return newPermissions;
    });
  };

  const handleAccessLevelChange = (permissionId, accessLevel) => {
    setSelectedPermissions((prev) => ({
      ...prev,
      [permissionId]: accessLevel,
    }));
  };

  const handleSave = () => {
    const permissions = Object.entries(selectedPermissions).map(
      ([permissionId, accessLevel]) => ({
        permissionId,
        accessLevel,
      }),
    );
    saveMutation.mutate(permissions);
  };

  const handleSelectAll = (modulePermissions) => {
    const newPermissions = { ...selectedPermissions };
    modulePermissions.forEach((perm) => {
      newPermissions[perm.permissionId] = "read";
    });
    setSelectedPermissions(newPermissions);
  };

  const handleDeselectAll = (modulePermissions) => {
    const newPermissions = { ...selectedPermissions };
    modulePermissions.forEach((perm) => {
      delete newPermissions[perm.permissionId];
    });
    setSelectedPermissions(newPermissions);
  };

  // Group permissions by module (must be before any early returns — Rules of Hooks)
  const modules = useMemo(() => {
    const perms = permissionsData?.data?.permissions || [];
    const grouped = {};
    perms.forEach((p) => {
      const key = p.module;
      if (!grouped[key]) {
        grouped[key] = { module: key, permissions: [] };
      }
      grouped[key].permissions.push(p);
    });
    return Object.values(grouped);
  }, [permissionsData]);

  if (permissionsLoading || rolePermissionsLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spin size="large" tip="Loading permissions..." />
      </div>
    );
  }

  return (
    <div>
      <Alert
        message={`Managing permissions for: ${role?.roleName}`}
        description={role?.description}
        type="info"
        showIcon
        className="mb-4"
      />

      <Collapse defaultActiveKey={modules.map((m) => m.module)}>
        {modules.map((moduleData) => {
          const modulePermissions = moduleData.permissions;
          const selectedCount = modulePermissions.filter(
            (p) => selectedPermissions[p.permissionId],
          ).length;

          return (
            <Panel
              header={
                <div className="flex justify-between items-center">
                  <span className="font-semibold capitalize">
                    {moduleData.module}
                  </span>
                  <span className="text-sm text-gray-500">
                    {selectedCount} / {modulePermissions.length} selected
                  </span>
                </div>
              }
              key={moduleData.module}
              extra={
                <Space size="small" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => handleSelectAll(modulePermissions)}
                  >
                    Select All
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    onClick={() => handleDeselectAll(modulePermissions)}
                  >
                    Deselect All
                  </Button>
                </Space>
              }
            >
              <div className="space-y-3">
                {modulePermissions.map((permission) => {
                  const isChecked =
                    !!selectedPermissions[permission.permissionId];
                  const accessLevel =
                    selectedPermissions[permission.permissionId] || "read";

                  return (
                    <div
                      key={permission.permissionId}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded"
                    >
                      <div className="flex items-center flex-1">
                        <Checkbox
                          checked={isChecked}
                          onChange={(e) =>
                            handlePermissionChange(
                              permission.permissionId,
                              e.target.checked,
                            )
                          }
                        >
                          <div>
                            <div className="font-medium">
                              {permission.submodule ? (
                                <>
                                  {permission.module} → {permission.submodule}
                                </>
                              ) : (
                                permission.module
                              )}
                            </div>
                            <div className="text-xs text-gray-500">
                              {permission.description}
                            </div>
                          </div>
                        </Checkbox>
                      </div>

                      {isChecked && (
                        <Select
                          value={accessLevel}
                          onChange={(value) =>
                            handleAccessLevelChange(
                              permission.permissionId,
                              value,
                            )
                          }
                          style={{ width: 120 }}
                          size="small"
                        >
                          <Select.Option value="read">Read Only</Select.Option>
                          <Select.Option value="write">
                            Full Access
                          </Select.Option>
                        </Select>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          );
        })}
      </Collapse>

      <div className="mt-6 flex justify-end">
        <Space>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            type="primary"
            onClick={handleSave}
            loading={saveMutation.isLoading}
            className="bg-gradient-to-r from-blue-500 to-indigo-600 border-0"
          >
            Save Permissions
          </Button>
        </Space>
      </div>
    </div>
  );
};

export default PermissionsDrawer;
