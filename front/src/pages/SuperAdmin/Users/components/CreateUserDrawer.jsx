import {
  Drawer,
  Form,
  Input,
  Select,
  Button,
  Divider,
  Modal,
  Typography,
} from "antd";
import { UserPlus, Copy, Check } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useCreateSuperAdminUser } from "../../../../services/requests/superadmin/users";
import { useGetOrganizations } from "../../../../services/requests/superadmin/organizations";
import { useGetBranches } from "../../../../services/requests/superadmin/branches";

const { Text } = Typography;

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

const CreateUserDrawer = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const createUserMutation = useCreateSuperAdminUser();

  // Success modal state
  const [successModalVisible, setSuccessModalVisible] = useState(false);
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedField, setCopiedField] = useState(null);

  // Get organizations for brand selection
  const { data: orgsData } = useGetOrganizations({ pageSize: 100 });

  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.brandId,
      label: org.name,
    }));
  }, [orgsData]);

  // Watch selected brand to fetch its branches
  const selectedBrandId = Form.useWatch("brandId", form);

  const { data: branchesData } = useGetBranches({
    brandId: selectedBrandId,
    pageSize: 100,
  });

  const branchOptions = useMemo(() => {
    if (!branchesData?.data?.data) return [];
    return branchesData.data.data.map((branch) => ({
      value: branch.branchId,
      label: branch.name,
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
  }, [selectedBrandId, form]);

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
        title={
          <div className="flex items-center gap-2">
            <div
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: "var(--gradient-primary)" }}
            >
              <UserPlus className="w-4 h-4 text-white" />
            </div>
            <span>Create Owner Account</span>
          </div>
        }
        open={open}
        onClose={onClose}
        width={480}
        footer={
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>Cancel</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={createUserMutation.isPending}
              style={{ background: "var(--gradient-primary)", border: "none" }}
            >
              Create Owner
            </Button>
          </div>
        }
      >
        <Form form={form} layout="vertical">
          <Divider orientation="left" orientationMargin={0}>
            Organization
          </Divider>

          <Form.Item
            name="brandId"
            label="Organization"
            rules={[
              { required: true, message: "Please select an organization" },
            ]}
          >
            <Select
              placeholder="Select organization"
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
                selectedBrandId
                  ? "Select branch"
                  : "Select an organization first"
              }
              options={branchOptions}
              showSearch
              optionFilterProp="label"
              size="large"
              disabled={!selectedBrandId}
            />
          </Form.Item>

          <Divider orientation="left" orientationMargin={0}>
            User Information
          </Divider>

          <div className="grid grid-cols-2 gap-3">
            <Form.Item
              name="firstName"
              label="First Name"
              rules={[{ required: true, message: "Required" }]}
            >
              <Input placeholder="First name" size="large" />
            </Form.Item>

            <Form.Item
              name="lastName"
              label="Last Name"
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
            <Input placeholder="owner@company.com" size="large" />
          </Form.Item>

          <Form.Item name="phone" label="Phone">
            <Input placeholder="09XX XXX XXXX" size="large" />
          </Form.Item>

          <p className="text-xs text-slate-500 mt-2">
            A secure password will be auto-generated and shown after creation.
          </p>
        </Form>
      </Drawer>

      {/* Success Modal — shows credentials to copy */}
      <Modal
        open={successModalVisible}
        onCancel={handleSuccessModalClose}
        onOk={handleSuccessModalClose}
        okText="Done"
        cancelButtonProps={{ style: { display: "none" } }}
        title={
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
              <Check className="w-4 h-4 text-emerald-600" />
            </div>
            <span>Owner Account Created</span>
          </div>
        }
        width={460}
      >
        {createdCredentials && (
          <div className="space-y-4 mt-4">
            <p className="text-sm text-slate-600">
              Account for <strong>{createdCredentials.name}</strong> has been
              created. Please copy and share the credentials below.
            </p>

            {/* Email */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <Text className="text-xs text-slate-500 uppercase font-semibold tracking-wide">
                Email
              </Text>
              <div className="flex items-center justify-between">
                <Text className="font-mono text-sm">
                  {createdCredentials.email}
                </Text>
                <Button
                  type="text"
                  size="small"
                  icon={
                    copiedField === "email" ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
                    )
                  }
                  onClick={() => handleCopy(createdCredentials.email, "email")}
                />
              </div>
            </div>

            {/* Password */}
            <div className="bg-slate-50 rounded-xl p-4 space-y-1">
              <Text className="text-xs text-slate-500 uppercase font-semibold tracking-wide">
                Password
              </Text>
              <div className="flex items-center justify-between">
                <Text className="font-mono text-sm font-bold">
                  {createdCredentials.password}
                </Text>
                <Button
                  type="text"
                  size="small"
                  icon={
                    copiedField === "password" ? (
                      <Check className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-slate-400" />
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
                  <Check className="w-4 h-4 text-emerald-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )
              }
              className="mt-2"
            >
              {copiedField === "all" ? "Copied!" : "Copy All Credentials"}
            </Button>

            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-3 mt-3">
              ⚠️ This password will not be shown again. Make sure to copy it
              now.
            </p>
          </div>
        )}
      </Modal>
    </>
  );
};

export default CreateUserDrawer;
