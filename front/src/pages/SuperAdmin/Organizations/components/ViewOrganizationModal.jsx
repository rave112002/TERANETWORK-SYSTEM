import { Modal, Descriptions, Tag, Avatar, Divider, Button } from "antd";
import {
  Building2,
  MapPin,
  Phone,
  Mail,
  Users,
  Calendar,
  CheckCircle,
  XCircle,
  Edit,
} from "lucide-react";

const ViewOrganizationModal = ({ open, onClose, organization }) => {
  if (!organization) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <Avatar
            src={organization.logo}
            size={48}
            icon={<Building2 className="w-6 h-6" />}
          />
          <div>
            <div className="text-lg font-semibold">{organization.name}</div>
            <div className="text-sm text-gray-500 font-normal">
              Organization Details
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={700}
      footer={[
        <Button key="close" size="large" onClick={onClose}>
          Close
        </Button>,
        <Button
          key="edit"
          type="primary"
          size="large"
          icon={<Edit className="w-4 h-4" />}
          style={{
            background: "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
          }}
        >
          Edit Organization
        </Button>,
      ]}
    >
      <div className="mt-6 space-y-6">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Tag
            icon={
              organization.status === "active" ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )
            }
            color={organization.status === "active" ? "success" : "default"}
            className="text-sm px-3 py-1"
          >
            {organization.status === "active" ? "Active" : "Inactive"}
          </Tag>
          <Tag color="blue" className="text-sm px-3 py-1">
            {organization.subscription}
          </Tag>
        </div>

        {/* Basic Information */}
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Building2 className="w-5 h-5 text-blue-600" />
            Basic Information
          </h3>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Organization Name">
              {organization.name}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </span>
              }
            >
              {organization.address}, {organization.city}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </span>
              }
            >
              {organization.phone}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </span>
              }
            >
              {organization.email}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider />

        {/* Contact Person */}
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Contact Person
          </h3>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Name">
              {organization.contactPerson}
            </Descriptions.Item>
            <Descriptions.Item label="Email">
              {organization.email}
            </Descriptions.Item>
            <Descriptions.Item label="Phone">
              {organization.phone}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider />

        {/* Statistics */}
        <div>
          <h3 className="text-base font-semibold mb-4">Statistics</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">Branches</div>
              <div className="text-2xl font-bold text-blue-600">
                {organization.branches}
              </div>
            </div>
            <div className="p-4 bg-purple-50 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">Staff Members</div>
              <div className="text-2xl font-bold text-purple-600">
                {organization.staff}
              </div>
            </div>
            <div className="p-4 bg-green-50 rounded-xl">
              <div className="text-sm text-gray-600 mb-1">Subscription</div>
              <div className="text-lg font-bold text-green-600">
                {organization.subscription}
              </div>
            </div>
          </div>
        </div>

        <Divider />

        {/* Additional Info */}
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-orange-600" />
            Additional Information
          </h3>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Created Date">
              {new Date(organization.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Descriptions.Item>
            <Descriptions.Item label="Organization ID">
              {organization.id}
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>
    </Modal>
  );
};

export default ViewOrganizationModal;
