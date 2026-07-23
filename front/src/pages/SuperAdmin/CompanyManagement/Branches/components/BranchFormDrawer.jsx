import { PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Form, Input, Select, Tooltip } from "antd";
import { Building2, Mail, MapPin, Phone, X } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import {
  useCreateBranch,
  useUpdateBranch,
} from "../../../../../services/requests/superadmin/branches";
import { useGetCompanies } from "../../../../../services/requests/superadmin/companies";
import SectionLabel from "../../../../../components/SectionLabel";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  handlePhoneInput,
  phoneValidator,
} from "../../../../../utils/phoneFormat";

const { TextArea } = Input;

// Branch status is a 4-value enum, so this is a Select rather than the binary
// StatusToggle. 'Deleted' is reached through the delete action, not this form.
const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
  { value: "Suspended", label: "Suspended" },
];

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

/**
 * Create/edit a branch. `entity` presence flips edit mode (props contract per
 * front/docs/ui-form-design.md).
 */
const BranchFormDrawer = ({ open, onClose, onSuccess, entity }) => {
  const [form] = Form.useForm();
  const isEditMode = !!entity;
  const createMutation = useCreateBranch();
  const updateMutation = useUpdateBranch();
  const initialValuesRef = useRef({});

  const { data: orgsData } = useGetCompanies({ pageSize: 100 });

  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.companyId,
      label: org.name,
    }));
  }, [orgsData]);

  // Hydrate on open. Map fields explicitly — API rows carry extra keys.
  useEffect(() => {
    if (!open) return;
    if (entity) {
      const values = {
        companyId: entity.companyId,
        name: entity.name,
        email: entity.email,
        phone: entity.phone,
        address: entity.address,
        status: entity.status,
      };
      form.setFieldsValue(values);
      initialValuesRef.current = values;
    } else {
      form.resetFields();
      initialValuesRef.current = {};
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

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    if (saveDisabled) return;
    try {
      const values = await form.validateFields();

      if (isEditMode) {
        // The PUT endpoint does not accept companyId — a branch can't be moved
        // between companies here, so it's deliberately omitted.
        await updateMutation.mutateAsync({
          branchId: entity.branchId,
          branchData: {
            name: values.name,
            email: values.email || null,
            phone: values.phone || null,
            address: values.address || null,
            status: values.status,
          },
        });
      } else {
        await createMutation.mutateAsync({
          companyId: values.companyId,
          name: values.name,
          email: values.email || null,
          phone: values.phone || null,
          address: values.address || null,
        });
      }

      form.resetFields();
      onSuccess?.();
    } catch (err) {
      if (err?.errorFields?.length) return focusFirstError(form, err);
      // mutation errors already surface a toast via onError
      console.error("Branch form error:", err);
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
            <MapPin className="w-[22px] h-[22px] text-white" />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 font-semibold leading-tight"
              style={{ fontSize: 19, color: "var(--color-text-dark)" }}
            >
              {isEditMode ? "Edit Branch" : "Create New Branch"}
            </h2>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {isEditMode
                ? "Update branch information"
                : "Add a branch to a company"}
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
        {/* Company */}
        <div>
          <SectionLabel>Company</SectionLabel>

          <Form.Item
            name="companyId"
            label="Company"
            rules={[{ required: true, message: "Please select a company" }]}
            extra={
              isEditMode
                ? "A branch can't be moved to a different company."
                : undefined
            }
          >
            <Select
              placeholder="Select company"
              options={orgOptions}
              showSearch
              optionFilterProp="label"
              size="large"
              disabled={isEditMode}
            />
          </Form.Item>
        </div>

        {/* Branch details */}
        <div className="mt-7">
          <SectionLabel>Branch details</SectionLabel>

          <Form.Item
            name="name"
            label="Branch name"
            rules={[
              { required: true, message: "Branch name is required" },
              { max: 100, message: "Must be 100 characters or fewer" },
            ]}
          >
            <Input
              prefix={
                <Building2
                  className="w-4 h-4 mr-2"
                  style={{ color: "var(--color-text-muted)" }}
                />
              }
              placeholder="e.g., Main Branch, Downtown Office"
              size="large"
            />
          </Form.Item>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="email"
              label="Email"
              rules={[{ type: "email", message: "Please enter a valid email" }]}
            >
              <Input
                prefix={
                  <Mail
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                placeholder="branch@company.com"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="phone"
              label="Phone"
              rules={[{ validator: phoneValidator }]}
            >
              <Input
                prefix={
                  <Phone
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                placeholder={PHONE_PLACEHOLDER}
                size="large"
                onChange={(e) => handlePhoneInput(e, form)}
                maxLength={PHONE_MAX_LENGTH}
              />
            </Form.Item>
          </div>

          <Form.Item name="address" label="Address">
            <TextArea
              placeholder="Full branch address"
              rows={3}
              showCount
              maxLength={255}
            />
          </Form.Item>
        </div>

        {/* Status — update-only; creation always starts a branch as Active */}
        {isEditMode && (
          <div className="mt-7">
            <SectionLabel>Access status</SectionLabel>
            <Form.Item name="status" label="Status">
              <Select options={STATUS_OPTIONS} size="large" />
            </Form.Item>
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
              icon={isEditMode ? undefined : <PlusOutlined />}
              onClick={handleSubmit}
              disabled={saveDisabled}
              loading={createMutation.isPending || updateMutation.isPending}
              size="large"
            >
              {isEditMode ? "Update Branch" : "Create Branch"}
            </Button>
          </span>
        </Tooltip>
      </div>
    </Drawer>
  );
};

export default BranchFormDrawer;
