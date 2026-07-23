import { useQuery } from "@tanstack/react-query";
import { PlusOutlined } from "@ant-design/icons";
import { App, Button, Drawer, Form, Input, Select, Tooltip } from "antd";
import { Eye, EyeOff, Lock, Mail, Phone, Shield, Users, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import PasswordStrengthIndicator from "../../../../../components/PasswordStrengthIndicator";
import SectionLabel from "../../../../../components/SectionLabel";
import StatusToggle from "../../../../../components/StatusToggle";
import { getRoles } from "../../../../../services/api/admin/roles";
import {
  useCreateUser,
  useUpdateUser,
} from "../../../../../services/requests/admin/user";
import { useAdminAuthStore } from "../../../../../store/authStore";
import { validationRules } from "../../../../../utils/validation";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  handlePhoneInput,
  phoneValidator,
} from "../../../../../utils/phoneFormat";

const { Option } = Select;

// Dependency-free value compare for the dirty check. dayjs serialises to ISO via
// toJSON (stable); null/undefined/"" are treated as equal.
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

export default function UserFormDrawer({
  open,
  onClose,
  onSuccess,
  entity = null,
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const [showPassword, setShowPassword] = useState(false);
  const [password, setPassword] = useState("");
  const { userData } = useAdminAuthStore();
  const initialValuesRef = useRef({});

  const createUserMutation = useCreateUser();
  const updateUserMutation = useUpdateUser();

  const isEditMode = !!entity;

  // Fetch roles
  const { data: rolesData } = useQuery({
    queryKey: ["roles", { status: "Active" }],
    queryFn: () => getRoles({ status: "Active", pageSize: 100 }),
  });

  const roles = rolesData?.data?.roles || [];

  // Hydrate (and snapshot the baseline) every time the drawer opens.
  useEffect(() => {
    if (!open) return;
    if (entity) {
      const values = {
        firstName: entity.firstName,
        lastName: entity.lastName,
        email: entity.email,
        phone: entity.phone,
        roleId: entity.roleId,
        status: entity.status,
      };
      form.setFieldsValue(values);
      initialValuesRef.current = values;
    } else {
      form.resetFields();
      const defaults = { status: "Active" };
      form.setFieldsValue(defaults);
      initialValuesRef.current = defaults;
      setPassword("");
    }
  }, [open, entity, form]);

  // Live dirty flag — Form.useWatch makes `watchedValues` reactive on every change.
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

  const handleClose = () => {
    form.resetFields();
    setPassword("");
    setShowPassword(false);
    onClose();
  };

  const handleSubmit = async () => {
    if (isEditMode && !isDirty) {
      message.info("No changes to save");
      return;
    }
    try {
      const values = await form.validateFields();

      const payload = {
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phone: values.phone,
        roleId: values.roleId,
        status: values.status,
        companyId: userData?.companyId,
      };

      if (isEditMode) {
        await updateUserMutation.mutateAsync({
          userId: entity.accountId,
          userData: payload,
        });
      } else {
        await createUserMutation.mutateAsync({
          ...payload,
          password: values.password,
        });
      }

      form.resetFields();
      setPassword("");
      onSuccess?.();
    } catch (error) {
      if (error?.errorFields?.length) return focusFirstError(form, error);
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
            <Users className="w-[22px] h-[22px] text-white" />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 font-semibold leading-tight"
              style={{ fontSize: 19, color: "var(--color-text-dark)" }}
            >
              {isEditMode ? "Edit User" : "Create New User"}
            </h2>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {isEditMode
                ? "Update user account and permissions"
                : "Add a new team member to your company"}
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
        {/* Personal information */}
        <div>
          <SectionLabel>Personal information</SectionLabel>

          <div className="grid grid-cols-2 gap-4">
            <Form.Item
              name="firstName"
              label="First name"
              rules={[{ required: true, message: "First name is required" }]}
            >
              <Input placeholder="Juan" size="large" />
            </Form.Item>

            <Form.Item
              name="lastName"
              label="Last name"
              rules={[{ required: true, message: "Last name is required" }]}
            >
              <Input placeholder="Dela Cruz" size="large" />
            </Form.Item>
          </div>
        </div>

        {/* Contact information */}
        <div className="mt-7">
          <SectionLabel>Contact information</SectionLabel>

          <Form.Item
            name="email"
            label="Email address"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email address" },
            ]}
          >
            <Input
              placeholder="juan@example.com"
              prefix={
                <Mail
                  className="w-4 h-4 mr-2"
                  style={{ color: "var(--color-text-muted)" }}
                />
              }
              disabled={isEditMode}
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label="Phone number"
            rules={[{ validator: phoneValidator }]}
          >
            <Input
              placeholder={PHONE_PLACEHOLDER}
              prefix={
                <Phone
                  className="w-4 h-4 mr-2"
                  style={{ color: "var(--color-text-muted)" }}
                />
              }
              size="large"
              onChange={(e) => handlePhoneInput(e, form)}
              maxLength={PHONE_MAX_LENGTH}
            />
          </Form.Item>
        </div>

        {/* Role & access */}
        <div className="mt-7">
          <SectionLabel>Role &amp; access</SectionLabel>

          <Form.Item
            name="roleId"
            label="Role"
            rules={[{ required: true, message: "Please select a role" }]}
          >
            <Select
              placeholder="Select role"
              size="large"
              showSearch
              optionFilterProp="children"
            >
              {roles.map((role) => (
                <Option key={role.roleId} value={role.roleId}>
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    {role.roleName}
                  </span>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="status"
            label="Status"
            initialValue="Active"
            rules={[{ required: true, message: "Please select a status" }]}
          >
            <StatusToggle />
          </Form.Item>
        </div>

        {/* Security — create mode only */}
        {!isEditMode && (
          <div className="mt-7">
            <SectionLabel>Security</SectionLabel>

            <Form.Item
              name="password"
              label="Temporary password"
              required
              rules={[validationRules.strongPassword(8)]}
            >
              <Input
                type={showPassword ? "text" : "password"}
                placeholder="Enter temporary password"
                prefix={
                  <Lock
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                suffix={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="transition-colors"
                    style={{ color: "var(--color-text-muted)" }}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                }
                size="large"
                onChange={(e) => setPassword(e.target.value)}
              />
            </Form.Item>

            <PasswordStrengthIndicator password={password} />

            <p
              className="mt-3"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              User will be prompted to change this on first login.
            </p>
          </div>
        )}
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
              loading={
                createUserMutation.isPending || updateUserMutation.isPending
              }
              size="large"
            >
              {isEditMode ? "Update User" : "Create User"}
            </Button>
          </span>
        </Tooltip>
      </div>
    </Drawer>
  );
}
