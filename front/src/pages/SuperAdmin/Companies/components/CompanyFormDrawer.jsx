import { CloudUploadOutlined, PlusOutlined } from "@ant-design/icons";
import {
  App,
  Button,
  Drawer,
  Form,
  Input,
  Select,
  Tooltip,
  Upload,
} from "antd";
import { Building2, Mail, Phone, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  useCreateCompany,
  useUpdateCompany,
} from "../../../../services/requests/superadmin/companies";
import { getImageUrl, validateImageFile } from "../../../../utils/upload";
import { deleteFileApi } from "../../../../services/api/upload";
import SectionLabel from "../../../../components/SectionLabel";
import {
  PHONE_MAX_LENGTH,
  PHONE_PLACEHOLDER,
  formatPhoneNumber,
  handlePhoneInput,
  phoneValidator,
} from "../../../../utils/phoneFormat";

const MAX_FILE_MB = 2;

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

export default function CompanyFormDrawer({
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

  const createCompanyMutation = useCreateCompany();
  const updateCompanyMutation = useUpdateCompany();

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
          await updateCompanyMutation.mutateAsync({
            companyId: entity.id || entity.companyId,
            companyData: formData,
          });
        } else {
          await createCompanyMutation.mutateAsync(formData);
        }
      } else {
        // JSON payload (no file)
        const payload = { ...values };
        if (isEditMode && oldLogoPath) {
          payload.logoUrl = oldLogoPath;
        }

        if (isEditMode) {
          await updateCompanyMutation.mutateAsync({
            companyId: entity.id || entity.companyId,
            companyData: payload,
          });
        } else {
          await createCompanyMutation.mutateAsync(payload);
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
    createCompanyMutation.isPending || updateCompanyMutation.isPending;

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
            <Building2 className="w-[22px] h-[22px] text-white" />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 font-semibold leading-tight"
              style={{ fontSize: 19, color: "var(--color-text-dark)" }}
            >
              {isEditMode ? "Edit Company" : "Create New Company"}
            </h2>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              {isEditMode
                ? "Update company information"
                : "Branch and owner are created separately"}
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
        {/* Logo */}
        <div>
          <SectionLabel>Logo</SectionLabel>

          <div className="flex items-start gap-4">
            {logoPreview ? (
              <div className="relative group">
                <div
                  className="w-24 h-24 overflow-hidden"
                  style={{
                    borderRadius: 12,
                    border: "1px solid var(--color-line)",
                    background: "var(--color-surface-sunken)",
                  }}
                >
                  <img
                    src={logoPreview}
                    alt="Company logo preview"
                    className="w-full h-full object-cover"
                    width={96}
                    height={96}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  aria-label="Remove logo"
                  className="absolute -top-2 -right-2 w-7 h-7 inline-flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                  style={{
                    borderRadius: "50%",
                    background: "var(--color-error)",
                  }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div
                className="w-24 h-24 flex items-center justify-center"
                style={{
                  borderRadius: 12,
                  border: "1px dashed var(--color-line)",
                  background: "var(--color-surface-sunken)",
                }}
              >
                <Building2
                  className="w-8 h-8"
                  style={{ color: "var(--color-text-muted)" }}
                />
              </div>
            )}

            <div className="flex-1">
              <Upload
                accept="image/*"
                showUploadList={false}
                beforeUpload={() => false}
                onChange={handleLogoChange}
              >
                <Button icon={<CloudUploadOutlined />} size="large">
                  {logoPreview ? "Change logo" : "Upload logo"}
                </Button>
              </Upload>
              <p
                className="m-0 mt-2"
                style={{ fontSize: 12, color: "var(--color-text-muted)" }}
              >
                Recommended: square image, max {MAX_FILE_MB}MB
                <br />
                Supported: JPG, PNG, GIF, WebP
              </p>
            </div>
          </div>
        </div>

        {/* Company details */}
        <div className="mt-7">
          <SectionLabel>Company details</SectionLabel>

          <Form.Item
            name="name"
            label="Company name"
            rules={[{ required: true, message: "Company name is required" }]}
          >
            <Input
              prefix={
                <Building2
                  className="w-4 h-4 mr-2"
                  style={{ color: "var(--color-text-muted)" }}
                />
              }
              placeholder="e.g., Apex Digital Solutions"
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
                prefix={
                  <Mail
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                placeholder="org@example.com"
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

          <Form.Item name="website" label="Website (optional)">
            <Input placeholder="https://www.example.com" size="large" />
          </Form.Item>
        </div>

        {/* Subscription */}
        <div className="mt-7">
          <SectionLabel>Subscription</SectionLabel>

          <Form.Item
            name="subscriptionPlan"
            label="Plan"
            rules={[
              { required: true, message: "Please select a subscription plan" },
            ]}
          >
            <Select
              placeholder="Select a plan"
              size="large"
              options={[
                { value: "Basic", label: "Basic" },
                { value: "Standard", label: "Standard" },
                { value: "Premium", label: "Premium" },
                { value: "Enterprise", label: "Enterprise" },
              ]}
            />
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
              loading={isPending}
              size="large"
            >
              {isEditMode ? "Update Company" : "Create Company"}
            </Button>
          </span>
        </Tooltip>
      </div>
    </Drawer>
  );
}
