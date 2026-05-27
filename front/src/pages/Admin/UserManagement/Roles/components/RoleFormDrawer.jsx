import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  App,
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  Select,
  Tooltip,
} from "antd";
import { Shield } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import { createRole, updateRole } from "../../../../../services/api/admin/roles";

const { TextArea } = Input;
const { Option } = Select;

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
    () => !isFormEqual(watchedValues ?? form.getFieldsValue(), initialValuesRef.current),
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
        await updateMutation.mutateAsync({ roleId: entity.roleId, data: values });
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
      width={600}
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      <div className="h-full bg-linear-to-br from-slate-50 via-white to-slate-50 flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-500 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {isEditMode ? "Edit Role" : "Create New Role"}
            </h2>
          </div>
          <p className="text-sm text-slate-500 ml-11">
            {isEditMode
              ? "Update role information"
              : "Define a new role for your organization"}
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          requiredMark={true}
          autoComplete="off"
          className="flex-1 space-y-1"
        >
          {/* Role Details Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full"></span>
              Role Details
            </h3>

            <Form.Item
              label="Role Name"
              name="roleName"
              rules={[
                { required: true, message: "Please enter role name" },
                { min: 3, message: "Role name must be at least 3 characters" },
                { max: 50, message: "Role name must not exceed 50 characters" },
              ]}
            >
              <Input
                placeholder="e.g., Branch Manager"
                prefix={<Shield className="w-4 h-4 text-slate-400 mr-2" />}
                className="h-11 rounded-xl text-sm"
                size="large"
              />
            </Form.Item>

            <Form.Item
              label="Description"
              name="description"
              rules={[
                { required: true, message: "Please enter description" },
                {
                  min: 10,
                  message: "Description must be at least 10 characters",
                },
              ]}
            >
              <TextArea
                rows={4}
                placeholder="Describe what this role can access and do"
                className="rounded-xl text-sm"
                showCount
                maxLength={500}
              />
            </Form.Item>
          </div>

          <Divider className="my-6" />

          {/* Status Section */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full"></span>
              Access Status
            </h3>

            <Form.Item
              label="Status"
              name="status"
              initialValue="Active"
              rules={[{ required: true, message: "Please select status" }]}
            >
              <Select
                placeholder="Select status"
                className="h-11 rounded-xl text-sm"
                size="large"
              >
                <Option value="Active">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                    Active
                  </span>
                </Option>
                <Option value="Inactive">
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 bg-slate-300 rounded-full"></span>
                    Inactive
                  </span>
                </Option>
              </Select>
            </Form.Item>
          </div>
        </Form>

        {/* Footer */}
        <div
          className="mt-8 pt-6 border-t border-slate-200 flex justify-end gap-3"
          style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
        >
          <Button
            onClick={handleClose}
            className="h-11 px-6 rounded-xl font-medium text-slate-700 border-slate-200 hover:bg-slate-50"
            size="large"
          >
            Cancel
          </Button>
          <Tooltip title={saveDisabled ? "No changes to save yet" : undefined}>
            <span>
              <Button
                type="primary"
                onClick={handleSubmit}
                disabled={saveDisabled}
                loading={createMutation.isPending || updateMutation.isPending}
                className="h-11 px-8 rounded-xl font-medium border-none text-white"
                style={
                  saveDisabled
                    ? undefined
                    : {
                        background:
                          "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                      }
                }
                size="large"
              >
                {isEditMode ? "Update Role" : "Create Role"}
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </Drawer>
  );
}
