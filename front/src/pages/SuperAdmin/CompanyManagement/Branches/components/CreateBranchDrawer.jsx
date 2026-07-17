import { PlusOutlined } from "@ant-design/icons";
import { Button, Drawer, Form, Input, Select } from "antd";
import { Building2, Mail, MapPin, Phone, X } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useCreateBranch } from "../../../../../services/requests/superadmin/branches";
import { useGetCompanies } from "../../../../../services/requests/superadmin/companies";
import SectionLabel from "../../../../../components/SectionLabel";

const { TextArea } = Input;

const focusFirstError = (form, error) => {
  const first = error?.errorFields?.[0]?.name;
  if (first)
    form.scrollToField(first, {
      behavior: "smooth",
      block: "center",
      focus: true,
    });
};

const CreateBranchDrawer = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const createBranchMutation = useCreateBranch();

  // Get companies for company selection
  const { data: orgsData } = useGetCompanies({ pageSize: 100 });

  const orgOptions = useMemo(() => {
    if (!orgsData?.data?.data) return [];
    return orgsData.data.data.map((org) => ({
      value: org.companyId,
      label: org.name,
    }));
  }, [orgsData]);

  useEffect(() => {
    if (open) {
      form.resetFields();
    }
  }, [open, form]);

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      await createBranchMutation.mutateAsync(values);
      onSuccess?.();
    } catch (err) {
      if (err?.errorFields?.length) return focusFirstError(form, err);
      // mutation errors already surface a toast via onError
      console.error("Create branch error:", err);
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
              Create New Branch
            </h2>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              Add a branch to a company
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
        </div>

        {/* Branch details */}
        <div className="mt-7">
          <SectionLabel>Branch details</SectionLabel>

          <Form.Item
            name="name"
            label="Branch name"
            rules={[{ required: true, message: "Branch name is required" }]}
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
            <Form.Item name="email" label="Email">
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

            <Form.Item name="phone" label="Phone">
              <Input
                prefix={
                  <Phone
                    className="w-4 h-4 mr-2"
                    style={{ color: "var(--color-text-muted)" }}
                  />
                }
                placeholder="09XX XXX XXXX"
                size="large"
                maxLength={11}
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
          loading={createBranchMutation.isPending}
          size="large"
        >
          Create Branch
        </Button>
      </div>
    </Drawer>
  );
};

export default CreateBranchDrawer;
