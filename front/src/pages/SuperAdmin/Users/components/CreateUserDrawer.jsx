import { PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Form, Input, Modal, Select } from "antd";
import {
  AlertTriangle,
  Check,
  Copy,
  Mail,
  Phone,
  UserPlus,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCreateSuperAdminUser } from "../../../../services/requests/superadmin/users";
import { useGetCompanies } from "../../../../services/requests/superadmin/companies";
import { useGetBranches } from "../../../../services/requests/superadmin/branches";
import SectionLabel from "../../../../components/SectionLabel";
import { decodeHTML } from "../../../../utils/decode-html";

// Generate a random secure password
const generatePassword = (length = 12) => {
  const uppercase = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lowercase = "abcdefghjkmnpqrstuvwxyz";
  const numbers = "23456789";
  const special = "!@#$%&*";
  const all = uppercase + lowercase + numbers + special;

  let password = "";
  // Ensure at least one of each type
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle the password
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
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

// Uppercase micro-label for the credential wells.
const WellLabel = ({ children }) => (
  <span
    className="uppercase"
    style={{
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: "0.08em",
      color: "var(--color-text-muted)",
    }}
  >
    {children}
  </span>
);

const CreateUserDrawer = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const createUserMutation = useCreateSuperAdminUser();

  // Success modal state
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Get companies for company selection
  const { data: orgsData } = useGetCompanies({ pageSize: 100 });

  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.companyId,
      label: decodeHTML(org.name),
    }));
  }, [orgsData]);

  // Watch selected company to fetch its branches
  const selectedCompanyId = Form.useWatch("companyId", form);

  const { data: branchesData } = useGetBranches({
    companyId: selectedCompanyId,
    pageSize: 100,
  });

  const branchOptions = useMemo(() => {
    if (!branchesData?.data?.data) return [];
    return branchesData.data.data.map((branch) => ({
      value: branch.branchId,
      label: decodeHTML(branch.name),
    }));
  }, [branchesData]);

  // Reset form when drawer opens
  useEffect(() => {
    if (open) {
      form.resetFields();
      setCreatedCredentials(null);
    }
  }, [open, form]);

  // Clear branch when org changes
  useEffect(() => {
    form.setFieldValue("branchId", undefined);
  }, [selectedCompanyId, form]);

  const handleCopy = async (text, field) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Auto-generate password
      const password = generatePassword(12);

      await createUserMutation.mutateAsync({ ...values, password });

      // Show success modal with credentials
      setCreatedCredentials({
        email: values.email,
        password,
        name: `${values.firstName} ${values.lastName}`,
      });
      setSuccessModalVisible(true);

      form.resetFields();
    } catch (err) {
      if (err?.errorFields?.length) return focusFirstError(form, err);
      console.error("Create user error:", err);
    }
  };

  const handleSuccessModalClose = () => {
    setSuccessModalVisible(false);
    setCreatedCredentials(null);
    onSuccess?.();
  };

  return (
    <>
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
              <UserPlus className="w-[22px] h-[22px] text-white" />
            </span>
            <div className="min-w-0">
              <h2
                className="m-0 font-semibold leading-tight"
                style={{ fontSize: 19, color: "var(--color-text-dark)" }}
              >
                Create Owner Account
              </h2>
              <p
                className="m-0 mt-0.5"
                style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
              >
                Add an owner for a company branch
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
            >
              <Select
                placeholder="Select company"
                options={orgOptions}
                showSearch
                optionFilterProp="label"
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="branchId"
              label="Branch"
              rules={[{ required: true, message: "Please select a branch" }]}
            >
              <Select
                placeholder={
                  selectedCompanyId ? "Select branch" : "Select a company first"
                }
                options={branchOptions}
                showSearch
                optionFilterProp="label"
                size="large"
                disabled={!selectedCompanyId}
              />
            </Form.Item>
          </div>

          {/* User information */}
          <div className="mt-7">
            <SectionLabel>User information</SectionLabel>

            <div className="grid grid-cols-2 gap-3">
              <Form.Item
                name="firstName"
                label="First name"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input placeholder="First name" size="large" />
              </Form.Item>

              <Form.Item
                name="lastName"
                label="Last name"
                rules={[{ required: true, message: "Required" }]}
              >
                <Input placeholder="Last name" size="large" />
              </Form.Item>
            </div>

            <Form.Item
              name="email"
              label="Email"
              rules={[
                { required: true, message: "Required" },
                { type: "email", message: "Invalid email" },
              ]}
            >
              <Input
                placeholder="owner@company.com"
                prefix={
                  <Mail
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                size="large"
              />
            </Form.Item>

            <Form.Item name="phone" label="Phone">
              <Input
                placeholder="09XX XXX XXXX"
                prefix={
                  <Phone
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                size="large"
              />
            </Form.Item>

            <p
              className="m-0 mt-2"
              style={{ fontSize: 12, color: "var(--color-text-muted)" }}
            >
              A secure password will be auto-generated and shown after creation.
            </p>
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
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleSubmit}
            loading={createUserMutation.isPending}
            size="large"
          >
            Create Owner
          </Button>
        </div>
      </Drawer>

      {/* Success Modal — shows credentials to copy */}
      <Modal
        open={successModalVisible}
        onCancel={handleSuccessModalClose}
        onOk={handleSuccessModalClose}
        okText="Done"
        cancelButtonProps={{ style: { display: "none" } }}
        title={
          <div className="flex items-center gap-2.5">
            <span
              className="inline-flex items-center justify-center shrink-0"
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
              }}
            >
              <Check
                className="w-4 h-4"
                style={{ color: "var(--color-success)" }}
              />
            </span>
            <span>Owner Account Created</span>
          </div>
        }
        width={460}
      >
        {createdCredentials && (
          <div className="space-y-3 mt-4">
            <p
              className="m-0"
              style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
            >
              Account for <strong>{createdCredentials.name}</strong> has been
              created. Please copy and share the credentials below.
            </p>

            {/* Email */}
            <div
              className="p-4 space-y-1"
              style={{
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-card)",
              }}
            >
              <WellLabel>Email</WellLabel>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="font-mono truncate"
                  style={{ fontSize: 13, color: "var(--color-text-dark)" }}
                >
                  {createdCredentials.email}
                </span>
                <Button
                  type="text"
                  size="small"
                  aria-label="Copy email"
                  icon={
                    copiedField === "email" ? (
                      <Check
                        className="w-4 h-4"
                        style={{ color: "var(--color-success)" }}
                      />
                    ) : (
                      <Copy
                        className="w-4 h-4"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    )
                  }
                  onClick={() => handleCopy(createdCredentials.email, "email")}
                />
              </div>
            </div>

            {/* Password */}
            <div
              className="p-4 space-y-1"
              style={{
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-card)",
              }}
            >
              <WellLabel>Password</WellLabel>
              <div className="flex items-center justify-between gap-2">
                <span
                  className="font-mono truncate"
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--color-text-dark)",
                  }}
                >
                  {createdCredentials.password}
                </span>
                <Button
                  type="text"
                  size="small"
                  aria-label="Copy password"
                  icon={
                    copiedField === "password" ? (
                      <Check
                        className="w-4 h-4"
                        style={{ color: "var(--color-success)" }}
                      />
                    ) : (
                      <Copy
                        className="w-4 h-4"
                        style={{ color: "var(--color-text-muted)" }}
                      />
                    )
                  }
                  onClick={() =>
                    handleCopy(createdCredentials.password, "password")
                  }
                />
              </div>
            </div>

            {/* Copy All */}
            <Button
              block
              onClick={() =>
                handleCopy(
                  `Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`,
                  "all",
                )
              }
              icon={
                copiedField === "all" ? (
                  <Check
                    className="w-4 h-4"
                    style={{ color: "var(--color-success)" }}
                  />
                ) : (
                  <Copy className="w-4 h-4" />
                )
              }
            >
              {copiedField === "all" ? "Copied!" : "Copy All Credentials"}
            </Button>

            <div
              className="flex items-start gap-2 p-3"
              style={{
                border: "1px solid var(--color-line)",
                borderRadius: "var(--radius-control)",
              }}
            >
              <AlertTriangle
                className="w-3.5 h-3.5 shrink-0 mt-0.5"
                style={{ color: "var(--color-warning)" }}
              />
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                This password will not be shown again. Make sure to copy it now.
              </span>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CreateUserDrawer;
