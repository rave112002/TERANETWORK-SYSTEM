import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  CircleAlert,
  Info,
  Key,
  Loader2,
  Shield,
  TriangleAlert,
  X,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import Spinner from "../../../../../components/Spinner";
import DataTable from "../../../../../components/DataTable";
import {
  getUserPermissions,
  bulkUpdateUserPermissions,
} from "../../../../../services/api/admin/user-permissions";

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

  const { data, isLoading, error } = useQuery({
    queryKey: ["userPermissions", user?.accountId],
    queryFn: () => getUserPermissions(user.accountId),
    enabled: open && !!user?.accountId,
  });

  const updateMutation = useMutation({
    mutationFn: ({ accountId, permissions }) =>
      bulkUpdateUserPermissions(accountId, permissions),
    onSuccess: () => {
      toast.success("User permissions updated successfully");
      setHasChanges(false);
      queryClient.invalidateQueries({
        queryKey: ["userPermissions", user.accountId],
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error) => {
      toast.error(
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
        <div className="inline-flex items-center gap-2">
          <Select
            value={record.currentAccessLevel}
            onValueChange={(value) =>
              handleAccessLevelChange(record.permissionId, value)
            }
          >
            <SelectTrigger size="sm" className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="read">Read</SelectItem>
              <SelectItem value="write">Write</SelectItem>
            </SelectContent>
          </Select>
          {record.hasOverride && (
            <button
              type="button"
              onClick={() => handleRemoveOverride(record.permissionId)}
              className="text-[12.5px] cursor-pointer hover:underline"
              style={{ color: "var(--color-error)" }}
            >
              Reset
            </button>
          )}
        </div>
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

  const hasNoRole = !isLoading && data && !data?.data?.roleId;
  const overrideCount = permissions.filter((p) => p.hasOverride).length;

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full gap-0 p-0 sm:max-w-[1000px]"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Manage permissions</SheetTitle>

        <div className="flex h-full flex-col">
          <div className="flex-1 overflow-y-auto p-6">
            {/* Header */}
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
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Error loading permissions</AlertTitle>
                <AlertDescription>
                  {error.response?.data?.message ||
                    "Failed to load user permissions. Please try again."}
                </AlertDescription>
              </Alert>
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
                        style={{ fontWeight: 500, color: "var(--color-text-dark)" }}
                      >
                        {data.data.roleName || "No Role"}
                      </span>
                    </span>
                  </div>
                )}

                {!hasNoRole && (
                  <Alert className="mb-5">
                    <Info />
                    <AlertTitle>Permission overrides</AlertTitle>
                    <AlertDescription>
                      User-specific permissions will override role permissions.
                      Changes only affect this user.
                    </AlertDescription>
                  </Alert>
                )}

                {isLoading ? (
                  <div className="flex items-center justify-center h-64">
                    <Spinner size="large" />
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
                      This user has no role assigned. Please assign a role to the
                      user first before managing permissions.
                    </p>
                    <Alert className="max-w-md text-left">
                      <TriangleAlert />
                      <AlertTitle>How to assign a role</AlertTitle>
                      <AlertDescription>
                        Edit the user and select a role from the Role dropdown in
                        the user form.
                      </AlertDescription>
                    </Alert>
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
                      The assigned role has no permissions configured. Please
                      configure permissions for the role first.
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
                    <DataTable
                      columns={columns}
                      dataSource={permissions}
                      rowKey="permissionId"
                      scroll={{ x: 820 }}
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="flex items-center justify-between gap-3 flex-wrap p-6 pt-5"
            style={{
              borderTop: "1px solid var(--color-line)",
              paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
            }}
          >
            <span
              className="text-[12.5px]"
              style={{ color: "var(--color-text-muted)" }}
            >
              {hasNoRole
                ? "No role assigned"
                : `${overrideCount} override${overrideCount === 1 ? "" : "s"}`}
            </span>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="lg"
                onClick={onClose}
                disabled={updateMutation.isPending}
              >
                {hasNoRole ? "Close" : "Cancel"}
              </Button>
              {!hasNoRole && (
                <>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleReset}
                    disabled={!hasChanges || updateMutation.isPending}
                  >
                    Reset changes
                  </Button>
                  <Button
                    size="lg"
                    onClick={handleSave}
                    disabled={!hasChanges || updateMutation.isPending}
                  >
                    {updateMutation.isPending && (
                      <Loader2 className="animate-spin" />
                    )}
                    Save permissions
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default UserPermissionsDrawer;
