import { Drawer, Form, Input, Select, Button, Divider } from "antd";
import { MapPin, Building2, Mail, Phone } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useCreateBranch } from "../../../../../services/requests/superadmin/branches";
import { useGetOrganizations } from "../../../../../services/requests/superadmin/organizations";

const CreateBranchDrawer = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const createBranchMutation = useCreateBranch();

  // Get organizations for brand selection
  const { data: orgsData } = useGetOrganizations({ pageSize: 100 });

  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.brandId,
      label: org.name,
    }));
  }, [orgsData]);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createBranchMutation.mutateAsync(values);
      onSuccess?.();
    } catch (err) {
      console.error("Create branch error:", err);
    }
  };

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg"
            style={{ background: "var(--gradient-primary)" }}
          >
            <MapPin className="w-4 h-4 text-white" />
          </div>
          <span>Create Branch</span>
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
            loading={createBranchMutation.isPending}
            style={{ background: "var(--gradient-primary)", border: "none" }}
          >
            Create Branch
          </Button>
        </div>
      }
    >
      <Form form={form} layout="vertical" requiredMark="optional">
        <Divider orientation="left" orientationMargin={0}>
          Organization
        </Divider>

        <Form.Item
          name="brandId"
          label="Organization"
          rules={[{ required: true, message: "Please select an organization" }]}
        >
          <Select
            placeholder="Select organization"
            options={orgOptions}
            showSearch
            optionFilterProp="label"
            size="large"
          />
        </Form.Item>

        <Divider orientation="left" orientationMargin={0}>
          Branch Information
        </Divider>

        <Form.Item
          name="name"
          label="Branch Name"
          rules={[{ required: true, message: "Branch name is required" }]}
        >
          <Input
            prefix={<Building2 className="w-4 h-4 text-slate-400 mr-2" />}
            placeholder="e.g., Main Branch, Downtown Office"
            size="large"
          />
        </Form.Item>

        <div className="grid grid-cols-2 gap-3">
          <Form.Item name="email" label="Email">
            <Input
              prefix={<Mail className="w-4 h-4 text-slate-400 mr-2" />}
              placeholder="branch@company.com"
              size="large"
            />
          </Form.Item>

          <Form.Item name="phone" label="Phone">
            <Input
              prefix={<Phone className="w-4 h-4 text-slate-400 mr-2" />}
              placeholder="09XX XXX XXXX"
              size="large"
              maxLength={11}
            />
          </Form.Item>
        </div>

        <Form.Item name="address" label="Address">
          <Input.TextArea
            placeholder="Full branch address"
            rows={3}
            size="large"
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
};

export default CreateBranchDrawer;
