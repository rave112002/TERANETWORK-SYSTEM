import { Modal, Descriptions, Tag, Avatar, Divider } from "antd";
import {
  User,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  Calendar,
  CheckCircle,
  XCircle,
} from "lucide-react";

const UserViewModal = ({ open, onClose, user }) => {
  if (!user) return null;

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <Avatar
            src={user.imageUrl}
            size={48}
            icon={<User className="w-6 h-6" />}
          />
          <div>
            <div className="text-lg font-semibold">
              {user.firstName} {user.lastName}
            </div>
            <div className="text-sm text-gray-500 font-normal">
              User Details
            </div>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width={700}
      footer={null}
    >
      <div className="mt-6 space-y-6">
        {/* Status Badge */}
        <div className="flex items-center gap-2">
          <Tag
            icon={
              user.status === "Active" ? (
                <CheckCircle className="w-3 h-3" />
              ) : (
                <XCircle className="w-3 h-3" />
              )
            }
            color={user.status === "Active" ? "success" : "default"}
            className="text-sm px-3 py-1"
          >
            {user.status}
          </Tag>
        </div>

        {/* Basic Information */}
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            Basic Information
          </h3>
          <Descriptions column={1} bordered>
            <Descriptions.Item label="Full Name">
              {user.firstName} {user.lastName}
            </Descriptions.Item>
            <Descriptions.Item label="Account ID">
              {user.accountId}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </span>
              }
            >
              {user.email}
            </Descriptions.Item>
            <Descriptions.Item
              label={
                <span className="flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </span>
              }
            >
              {user.phone}
            </Descriptions.Item>
          </Descriptions>
        </div>

        <Divider />

        {/* Work Information */}
        <div>
          <h3 className="text-base font-semibold mb-4 flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-purple-600" />
            Work Information
          </h3>
          <Descriptions column={1} bordered>
            <Descriptions.Item
              label={
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Branch
                </span>
              }
            >
              {user.branchName}
            </Descriptions.Item>
          </Descriptions>
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
              {new Date(user.dateCreated).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </Descriptions.Item>
            <Descriptions.Item label="User ID">{user.id}</Descriptions.Item>
          </Descriptions>
        </div>
      </div>
    </Modal>
  );
};

export default UserViewModal;
