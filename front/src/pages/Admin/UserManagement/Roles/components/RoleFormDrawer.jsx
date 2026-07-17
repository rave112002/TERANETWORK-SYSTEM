import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Drawer, Form, Input, Tooltip } from "antd";
import { Shield, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import {
  createRole,
  updateRole,
} from "../../../../../services/api/admin/roles";
import SectionLabel from "../../../../../components/SectionLabel";
import StatusToggle from "../../../../../components/StatusToggle";

const { TextArea } = Input;

// Dependency-free value compare for the dirty check.
const isFormEqual = (a = {}, b = {}) => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify(a[k] ?? "") !== JSON.stringify(b[k] ?? "")) return false;
  }
  return true;
};

const focusFirstError = (form, error) => {
  const first = error?.errorFields?.[0]?.name;
  if (first)
    form.scrollToField(first, {
      behavior: "smooth",
      block: "center",
      focus: true,
    });
};

export default function RoleFormDrawer({
  open,
  onClose,
  onSuccess,
  entity = null,
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const queryClient = useQueryClient();
  const initialValuesRef = useRef({});

  const isEditMode = !!entity;

  useEffect(() => {
    if (!open) return;
    if (entity) {
      const values = {
        roleName: entity.roleName,
        description: entity.description,
        status: entity.status,
      };
      form.setFieldsValue(values);
      initialValuesRef.current = values;
    } else {
      form.resetFields();
      const defaults = { status: "Active" };
      form.setFieldsValue(defaults);
      initialValuesRef.current = defaults;
    }
  }, [open, entity, form]);

  const watchedValues = Form.useWatch([], form);
  const isDirty = useMemo(
    () =>
      !isFormEqual(
        watchedValues ?? form.getFieldsValue(),
        initialValuesRef.current,
      ),
    [watchedValues, form],
  );
  const saveDisabled = isEditMode && !isDirty;

  const createMutation = useMutation({
    mutationFn: createRole,
    onSuccess: () => {
      message.success("Role created successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to create role");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ roleId, data }) => updateRole(roleId, data),
    onSuccess: () => {
      message.success("Role updated successfully");
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (error) => {
      message.error(error.response?.data?.message || "Failed to update role");
    },
  });

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    if (isEditMode && !isDirty) {
      message.info("No changes to save");
      return;
    }
    try {
      const values = await form.validateFields();

      if (isEditMode) {
        await updateMutation.mutateAsync({
          roleId: entity.roleId,
          data: values,
        });
      } else {
        await createMutation.mutateAsync(values);
      }

      form.resetFields();
      onSuccess?.();
    } catch (error) {
      if (error?.errorFields?.length) return focusFirstError(form, error);
      // mutation errors already surface a toast via onError
      console.error("Form submission error:", error);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      width={800}
      closable={false}
      styles={{ body: { padding: 24 } }}
    >
      {/* Header — accent chip + title + subtitle + bordered X */}
      <div className="flex items-start justify-between gap-3 mb-7">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
            <Shield className="w-[22px] h-[22px] text-white" />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 font-semibold leading-tight"
              style={{ fontSize: 19, color: "var(--color-text-dark)" }}
            >
              {isEditMode ? "Edit Role" : "Create New Role"}
            </h2>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {isEditMode
                ? "Update role information"
                : "Define a new role for your company"}
            </p>
          </div>
        </div>
        <button
          onClick={handleClose}
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

      <Form form={form} layout="vertical" requiredMark autoComplete="off">
        {/* Role details */}
        <div>
          <SectionLabel>Role details</SectionLabel>

          <Form.Item
            label="Role name"
            name="roleName"
            rules={[
              { required: true, message: "Please enter role name" },
              { min: 3, message: "Role name must be at least 3 characters" },
              { max: 50, message: "Role name must not exceed 50 characters" },
            ]}
          >
            <Input
              placeholder="e.g., Branch Manager"
              prefix={
                <Shield
                  className="w-4 h-4 mr-2"
                  style={{ color: "var(--color-text-muted)" }}
                />
              }
              size="large"
            />
          </Form.Item>

          {/* Optional: `roles.description` is TEXT NULL and the API writes
              `description || null`. Length is only checked once text is typed. */}
          <Form.Item
            label="Description"
            name="description"
            rules={[
              {
                min: 10,
                message: "Description must be at least 10 characters",
              },
            ]}
          >
            <TextArea
              rows={4}
              placeholder="Describe what this role can access and do"
              showCount
              maxLength={500}
            />
          </Form.Item>
        </div>

        {/* Access status */}
        <div className="mt-7">
          <SectionLabel>Access status</SectionLabel>

          <Form.Item
            label="Status"
            name="status"
            initialValue="Active"
            rules={[{ required: true, message: "Please select status" }]}
          >
            <StatusToggle />
          </Form.Item>
        </div>
      </Form>

      {/* Footer */}
      <div
        className="mt-8 pt-5 flex justify-end gap-3"
        style={{
          borderTop: "1px solid var(--color-line)",
          paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))",
        }}
      >
        <Button onClick={handleClose} size="large">
          Cancel
        </Button>
        <Tooltip title={saveDisabled ? "No changes to save yet" : undefined}>
          <span>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleSubmit}
              disabled={saveDisabled}
              loading={createMutation.isPending || updateMutation.isPending}
              size="large"
            >
              {isEditMode ? "Update Role" : "Create Role"}
            </Button>
          </span>
        </Tooltip>
      </div>
    </Drawer>
  );
}
