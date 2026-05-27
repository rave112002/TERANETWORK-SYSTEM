import { CloudUploadOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Divider,
  Drawer,
  Form,
  Input,
  Select,
  Tooltip,
  Upload,
} from "antd";
import { Building2, Mail, Phone } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCreateOrganization,
  useUpdateOrganization,
} from "../../../../services/requests/superadmin/organizations";
import {
  formatPhoneNumber,
  phoneValidator,
} from "../../../../utils/phoneFormat";
import { getImageUrl, validateImageFile } from "../../../../utils/upload";
import { deleteFileApi } from "../../../../services/api/upload";

const { Option } = Select;
const MAX_FILE_MB = 2;

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

export default function OrganizationFormDrawer({
  open,
  onClose,
  onSuccess,
  entity = null,
}) {
  const [form] = Form.useForm();
  const { message } = App.useApp();
  const initialValuesRef = useRef({});

  // Logo state
  const [logoPreview, setLogoPreview] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [oldLogoPath, setOldLogoPath] = useState(null);

  const createOrganizationMutation = useCreateOrganization();
  const updateOrganizationMutation = useUpdateOrganization();

  const isEditMode = !!entity;

  // ── Form hydration ──────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (entity) {
      const values = {
        name: entity.name,
        email: entity.email,
        phone: entity.phone,
        website: entity.website,
        subscriptionPlan: entity.subscriptionPlan,
      };
      form.setFieldsValue(values);
      initialValuesRef.current = values;
      setLogoPreview(
        entity.logo || entity.logoUrl
          ? getImageUrl(entity.logo || entity.logoUrl)
          : null,
      );
      setOldLogoPath(entity.logo || entity.logoUrl || null);
      setLogoFile(null);
    } else {
      form.resetFields();
      initialValuesRef.current = {};
      setLogoPreview(null);
      setLogoFile(null);
      setOldLogoPath(null);
    }
  }, [open, entity, form]);

  // ── Dirty check ────────────────────────────────────────────────
  const watchedValues = Form.useWatch([], form);
  const isDirty = useMemo(() => {
    const valuesChanged = !isFormEqual(
      watchedValues ?? form.getFieldsValue(),
      initialValuesRef.current,
    );
    return valuesChanged || !!logoFile;
  }, [watchedValues, logoFile, form]);
  const saveDisabled = isEditMode && !isDirty;

  // ── Logo upload handling ───────────────────────────────────────
  const handleLogoChange = (info) => {
    const file = info.file.originFileObj || info.file;

    // Validate
    const validation = validateImageFile(file, {
      maxSizeMB: MAX_FILE_MB,
      allowedTypes: ["image/jpeg", "image/png", "image/gif", "image/webp"],
    });

    if (!validation.valid) {
      message.error(validation.error);
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target.result);
    reader.readAsDataURL(file);
    setLogoFile(file);
  };

  const handleRemoveLogo = async () => {
    if (oldLogoPath && !oldLogoPath.startsWith("data:")) {
      try {
        await deleteFileApi(oldLogoPath, "superadmin");
      } catch {
        // best-effort
      }
    }
    setLogoPreview(null);
    setLogoFile(null);
    setOldLogoPath(null);
  };

  // ── Close / Reset ──────────────────────────────────────────────
  const handleClose = () => {
    form.resetFields();
    setLogoPreview(null);
    setLogoFile(null);
    setOldLogoPath(null);
    onClose();
  };

  // ── Submit ─────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (isEditMode && !isDirty) {
      message.info("No changes to save");
      return;
    }
    try {
      const values = await form.validateFields();
      if (values.phone) values.phone = formatPhoneNumber(values.phone);

      // Build payload — use FormData if logo file exists
      if (logoFile) {
        const formData = new FormData();
        Object.entries(values).forEach(([key, value]) => {
          if (value !== undefined && value !== null)
            formData.append(key, value);
        });
        formData.append("logo", logoFile);

        if (isEditMode) {
          await updateOrganizationMutation.mutateAsync({
            organizationId: entity.id || entity.brandId,
            organizationData: formData,
          });
        } else {
          await createOrganizationMutation.mutateAsync(formData);
        }
      } else {
        // JSON payload (no file)
        const payload = { ...values };
        if (isEditMode && oldLogoPath) {
          payload.logoUrl = oldLogoPath;
        }

        if (isEditMode) {
          await updateOrganizationMutation.mutateAsync({
            organizationId: entity.id || entity.brandId,
            organizationData: payload,
          });
        } else {
          await createOrganizationMutation.mutateAsync(payload);
        }
      }

      form.resetFields();
      setLogoPreview(null);
      setLogoFile(null);
      setOldLogoPath(null);
      onSuccess?.();
    } catch (error) {
      if (error?.errorFields?.length) return focusFirstError(form, error);
      console.error("Form submission error:", error);
    }
  };

  const isPending =
    createOrganizationMutation.isPending ||
    updateOrganizationMutation.isPending;

  return (
    <Drawer
      open={open}
      onClose={handleClose}
      width={520}
      closable={false}
      styles={{ body: { padding: 0 } }}
    >
      <div className="h-full bg-linear-to-br from-slate-50 via-white to-slate-50 flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 bg-linear-to-br from-blue-500 to-indigo-500 rounded-xl">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              {isEditMode ? "Edit Organization" : "Create Organization"}
            </h2>
          </div>
          <p className="text-sm text-slate-500 ml-11">
            {isEditMode
              ? "Update organization information"
              : "Add a new organization. Branch and Owner are created separately."}
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          requiredMark={true}
          className="flex-1 space-y-1"
        >
          {/* Logo Upload */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full" />
              Logo
            </h3>

            <div className="flex items-start gap-4">
              {logoPreview ? (
                <div className="relative group">
                  <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-50">
                    <img
                      src={logoPreview}
                      alt="Logo"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    className="absolute -top-2 -right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-lg cursor-pointer"
                  >
                    <DeleteOutlined className="text-xs" />
                  </button>
                </div>
              ) : (
                <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center">
                  <Building2 className="w-8 h-8 text-slate-400" />
                </div>
              )}

              <div className="flex-1">
                <Upload
                  accept="image/*"
                  showUploadList={false}
                  beforeUpload={() => false}
                  onChange={handleLogoChange}
                >
                  <Button
                    icon={<CloudUploadOutlined />}
                    className="rounded-xl font-medium"
                    size="large"
                  >
                    {logoPreview ? "Change Logo" : "Upload Logo"}
                  </Button>
                </Upload>
                <p className="text-xs text-slate-500 mt-2">
                  Recommended: Square image, max {MAX_FILE_MB}MB
                  <br />
                  Supported: JPG, PNG, GIF, WebP
                </p>
              </div>
            </div>
          </div>

          <Divider className="my-6" />

          {/* Organization Information */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full" />
              Organization Information
            </h3>

            <Form.Item
              name="name"
              label="Organization Name"
              rules={[
                { required: true, message: "Organization name is required" },
              ]}
            >
              <Input
                prefix={<Building2 className="w-4 h-4 text-slate-400 mr-2" />}
                placeholder="e.g., Apex Digital Solutions"
                className="h-11 rounded-xl text-sm"
                size="large"
              />
            </Form.Item>

            <div className="grid grid-cols-2 gap-4">
              <Form.Item
                name="email"
                label="Email"
                rules={[
                  { required: true, message: "Email is required" },
                  { type: "email", message: "Please enter a valid email" },
                ]}
              >
                <Input
                  prefix={<Mail className="w-4 h-4 text-slate-400 mr-2" />}
                  placeholder="org@example.com"
                  className="h-11 rounded-xl text-sm"
                  size="large"
                />
              </Form.Item>

              <Form.Item
                name="phone"
                label="Phone"
                rules={[{ validator: phoneValidator }]}
              >
                <Input
                  prefix={<Phone className="w-4 h-4 text-slate-400 mr-2" />}
                  placeholder="09XXXXXXXXX"
                  className="h-11 rounded-xl text-sm"
                  size="large"
                  maxLength={11}
                />
              </Form.Item>
            </div>

            <Form.Item name="website" label="Website (Optional)">
              <Input
                placeholder="https://www.example.com"
                className="h-11 rounded-xl text-sm"
                size="large"
              />
            </Form.Item>
          </div>

          <Divider className="my-6" />

          {/* Subscription Plan */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-linear-to-b from-blue-500 to-indigo-500 rounded-full" />
              Subscription Plan
            </h3>

            <Form.Item
              name="subscriptionPlan"
              label="Plan"
              rules={[
                {
                  required: true,
                  message: "Please select a subscription plan",
                },
              ]}
            >
              <Select
                placeholder="Select a plan"
                className="h-11 rounded-xl"
                size="large"
              >
                <Option value="Basic">Basic</Option>
                <Option value="Standard">Standard</Option>
                <Option value="Premium">Premium</Option>
                <Option value="Enterprise">Enterprise</Option>
              </Select>
            </Form.Item>
          </div>
        </Form>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200 flex justify-end gap-3">
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
                loading={isPending}
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
                {isEditMode ? "Update Organization" : "Create Organization"}
              </Button>
            </span>
          </Tooltip>
        </div>
      </div>
    </Drawer>
  );
}
