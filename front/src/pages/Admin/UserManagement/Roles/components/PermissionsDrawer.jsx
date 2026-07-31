import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Info,
  Key,
  Loader2,
  X,
} from "lucide-react";
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
import { getPermissions } from "../../../../../services/api/admin/permissions";
import {
  getRolePermissions,
  assignPermissions,
} from "../../../../../services/api/admin/roles";
import { decodeHTML } from "../../../../../utils/decode-html";

const ACCESS_OPTIONS = [
  { value: "read", label: "Read Only" },
  { value: "write", label: "Full Access" },
];

/** Circular check — green filled tick when on, hairline ring when off. */
const CircleCheck = ({ checked, onChange, label }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={label}
    onClick={() => onChange(!checked)}
    className="inline-flex items-center justify-center shrink-0 transition-colors"
    style={{
      width: 18,
      height: 18,
      borderRadius: "50%",
      cursor: "pointer",
      background: checked ? "var(--color-success)" : "transparent",
      border: checked ? "none" : "1.5px solid var(--color-line)",
    }}
  >
    {checked && (
      <Check className="w-3 h-3" style={{ color: "#fff" }} strokeWidth={3} />
    )}
  </button>
);

const PermissionsDrawer = ({ open, role, onClose }) => {
  const queryClient = useQueryClient();
  const [selectedPermissions, setSelectedPermissions] = useState({});
  const [collapsed, setCollapsed] = useState(() => new Set());

  const { data: permissionsData, isLoading: permissionsLoading } = useQuery({
    queryKey: ["permissions"],
    queryFn: () => getPermissions(),
    enabled: open,
  });

  const { data: rolePermissionsData, isLoading: rolePermissionsLoading } =
    useQuery({
      queryKey: ["rolePermissions", role?.roleId],
      queryFn: () => getRolePermissions(role.roleId),
      enabled: open && !!role?.roleId,
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
      toast.success("Permissions updated successfully");
      queryClient.invalidateQueries({
        queryKey: ["rolePermissions", role.roleId],
      });
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onClose();
    },
    onError: (error) => {
      toast.error(
        error.response?.data?.message || "Failed to update permissions",
      );
    },
  });

  const handlePermissionChange = (permissionId, checked) => {
    setSelectedPermissions((prev) => {
      const next = { ...prev };
      if (checked) next[permissionId] = "read";
      else delete next[permissionId];
      return next;
    });
  };

  const handleAccessLevelChange = (permissionId, accessLevel) => {
    setSelectedPermissions((prev) => ({ ...prev, [permissionId]: accessLevel }));
  };

  const handleSave = () => {
    const permissions = Object.entries(selectedPermissions).map(
      ([permissionId, accessLevel]) => ({ permissionId, accessLevel }),
    );
    saveMutation.mutate(permissions);
  };

  const handleSelectAll = (modulePermissions) => {
    setSelectedPermissions((prev) => {
      const next = { ...prev };
      modulePermissions.forEach((p) => {
        if (!next[p.permissionId]) next[p.permissionId] = "read";
      });
      return next;
    });
  };

  const handleDeselectAll = (modulePermissions) => {
    setSelectedPermissions((prev) => {
      const next = { ...prev };
      modulePermissions.forEach((p) => delete next[p.permissionId]);
      return next;
    });
  };

  const toggleModule = (moduleName) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(moduleName)) next.delete(moduleName);
      else next.add(moduleName);
      return next;
    });

  // Group permissions by module
  const modules = useMemo(() => {
    const perms = permissionsData?.data?.permissions || [];
    const grouped = {};
    perms.forEach((p) => {
      if (!grouped[p.module])
        grouped[p.module] = { module: p.module, permissions: [] };
      grouped[p.module].permissions.push(p);
    });
    return Object.values(grouped);
  }, [permissionsData]);

  const isLoading = permissionsLoading || rolePermissionsLoading;

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
        className="w-full gap-0 p-0 sm:max-w-200"
        style={{ background: "var(--color-surface)" }}
      >
        <SheetTitle className="sr-only">Manage Permissions</SheetTitle>

        <div className="flex flex-col h-full">
          {/* Header — X on the left, then accent chip + title */}
          <div
            className="shrink-0 flex items-center gap-3 px-5 py-3.5"
            style={{ borderBottom: "1px solid var(--color-line)" }}
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="icon-btn w-8 h-8 shrink-0"
            >
              <X className="w-4.5 h-4.5" />
            </button>
            <span className="inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0 bg-(image:--gradient-primary)">
              <Key className="w-5 h-5 text-white" />
            </span>
            <div className="min-w-0">
              <h2
                className="m-0 font-semibold leading-tight"
                style={{ fontSize: 19, color: "var(--color-text-dark)" }}
              >
                Manage Permissions
              </h2>
              <p
                className="m-0 mt-0.5"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                Configure access levels for this role
              </p>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {isLoading ? (
              <div className="flex justify-center items-center h-64">
                <Spinner size="large" />
              </div>
            ) : (
              <>
                {/* Info banner — which role is being edited */}
                <div
                  className="flex items-start gap-3 p-4"
                  style={{
                    background:
                      "color-mix(in srgb, var(--color-success) 8%, var(--color-surface))",
                    border:
                      "1px solid color-mix(in srgb, var(--color-success) 28%, transparent)",
                    borderRadius: 12,
                  }}
                >
                  <span
                    className="inline-flex items-center justify-center shrink-0"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: "50%",
                      background: "var(--color-success)",
                    }}
                  >
                    <Info className="w-3.5 h-3.5" style={{ color: "#fff" }} />
                  </span>
                  <div className="min-w-0">
                    <div
                      style={{
                        fontSize: 13.5,
                        fontWeight: 600,
                        color: "var(--color-text-dark)",
                      }}
                    >
                      Managing permissions for: {decodeHTML(role?.roleName)}
                    </div>
                    {role?.description && (
                      <div
                        className="mt-0.5"
                        style={{
                          fontSize: 13,
                          color: "var(--color-text-secondary)",
                        }}
                      >
                        {decodeHTML(role.description)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Module groups */}
                {modules.map(({ module: moduleName, permissions }) => {
                  const isOpen = !collapsed.has(moduleName);
                  const selectedCount = permissions.filter(
                    (p) => selectedPermissions[p.permissionId],
                  ).length;

                  return (
                    <div
                      key={moduleName}
                      style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-line)",
                        borderRadius: "var(--radius-card)",
                      }}
                    >
                      {/* Module header */}
                      <div className="flex items-center justify-between gap-3 px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggleModule(moduleName)}
                          aria-expanded={isOpen}
                          className="flex items-center gap-2 min-w-0 cursor-pointer"
                          style={{
                            background: "none",
                            border: "none",
                            padding: 0,
                          }}
                        >
                          <span style={{ color: "var(--color-text-muted)" }}>
                            {isOpen ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </span>
                          <span
                            className="capitalize truncate"
                            style={{
                              fontSize: 14.5,
                              fontWeight: 600,
                              color: "var(--color-text-dark)",
                            }}
                          >
                            {moduleName}
                          </span>
                        </button>

                        <div className="flex items-center gap-3 shrink-0">
                          <span
                            style={{
                              fontSize: 12.5,
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {selectedCount} / {permissions.length} selected
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSelectAll(permissions)}
                            className="cursor-pointer hover:underline"
                            style={{
                              fontSize: 12.5,
                              color: "var(--color-link)",
                            }}
                          >
                            Select All
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeselectAll(permissions)}
                            className="cursor-pointer hover:underline"
                            style={{
                              fontSize: 12.5,
                              color: "var(--color-link)",
                            }}
                          >
                            Deselect All
                          </button>
                        </div>
                      </div>

                      {/* Permission rows */}
                      {isOpen && (
                        <div className="px-4 pb-4 space-y-2">
                          {permissions.map((permission) => {
                            const isChecked =
                              !!selectedPermissions[permission.permissionId];
                            const accessLevel =
                              selectedPermissions[permission.permissionId] ||
                              "read";
                            const label = permission.submodule
                              ? `${permission.module} → ${permission.submodule}`
                              : permission.module;

                            return (
                              <div
                                key={permission.permissionId}
                                className="flex items-center justify-between gap-3 px-3.5 py-3"
                                style={{
                                  border: "1px solid var(--color-line)",
                                  borderRadius: 10,
                                }}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <CircleCheck
                                    checked={isChecked}
                                    onChange={(next) =>
                                      handlePermissionChange(
                                        permission.permissionId,
                                        next,
                                      )
                                    }
                                    label={label}
                                  />
                                  <div className="min-w-0">
                                    <div
                                      style={{
                                        fontSize: 13.5,
                                        fontWeight: 600,
                                        color: "var(--color-text-dark)",
                                      }}
                                    >
                                      {label}
                                    </div>
                                    {permission.description && (
                                      <div
                                        style={{
                                          fontSize: 12.5,
                                          color: "var(--color-text-muted)",
                                        }}
                                      >
                                        {decodeHTML(permission.description)}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {isChecked && (
                                  <Select
                                    value={accessLevel}
                                    onValueChange={(value) =>
                                      handleAccessLevelChange(
                                        permission.permissionId,
                                        value,
                                      )
                                    }
                                  >
                                    <SelectTrigger size="sm" className="w-35">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {ACCESS_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>
                                          {o.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* Footer */}
          <div
            className="shrink-0 flex justify-end gap-3 px-5 pt-4"
            style={{
              borderTop: "1px solid var(--color-line)",
              paddingBottom: "calc(1rem + env(safe-area-inset-bottom))",
            }}
          >
            <Button variant="outline" size="lg" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="lg"
              onClick={handleSave}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && (
                <Loader2 className="animate-spin" />
              )}
              Save permissions
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default PermissionsDrawer;
