import { Descriptions, Modal } from "antd";
import { Briefcase, Calendar, Mail, MapPin, Phone, User } from "lucide-react";
import dayjs from "dayjs";
import SectionLabel from "../../../../../components/SectionLabel";
import { decodeHTML } from "../../../../../utils/decode-html";

const labelWithIcon = (Icon, text) => (
  <span className="inline-flex items-center gap-2">
    <Icon className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
    {text}
  </span>
);

const UserViewModal = ({ open, onClose, user }) => {
  if (!user) return null;

  const name = `${decodeHTML(user.firstName) || ""} ${
    decodeHTML(user.lastName) || ""
  }`.trim();
  const initial = (name.charAt(0) || "?").toUpperCase();
  const active = user.status === "Active";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={640}
      footer={null}
      title={
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="overflow-hidden"
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--color-surface-sunken)",
              border: "1px solid var(--color-line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "none",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--color-text-secondary)",
            }}
          >
            {user.imageUrl ? (
              <img
                src={user.imageUrl}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              initial
            )}
          </span>
          <div className="min-w-0">
            <div
              className="truncate font-semibold leading-tight"
              style={{ fontSize: 16, color: "var(--color-text-dark)" }}
            >
              {name}
            </div>
            <div
              className="font-normal"
              style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
            >
              User details
            </div>
          </div>
        </div>
      }
    >
      <div className="mt-6 space-y-7">
        {/* Status */}
        <span
          className="inline-flex items-center gap-2"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: active
                ? "var(--color-success)"
                : "var(--color-text-muted)",
              boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
            }}
          />
          {user.status}
        </span>

        {/* Basic information */}
        <div>
          <SectionLabel>Basic information</SectionLabel>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={labelWithIcon(User, "Full name")}>
              {name || "-"}
            </Descriptions.Item>
            <Descriptions.Item label="Account ID">
              <span className="font-mono" style={{ fontSize: 12.5 }}>
                {user.accountId || "-"}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label={labelWithIcon(Mail, "Email")}>
              {decodeHTML(user.email) || "-"}
            </Descriptions.Item>
            <Descriptions.Item label={labelWithIcon(Phone, "Phone")}>
              {decodeHTML(user.phone) || "-"}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Work information */}
        <div>
          <SectionLabel>Work information</SectionLabel>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={labelWithIcon(Briefcase, "Role")}>
              {decodeHTML(user.roleName) || "No role"}
            </Descriptions.Item>
            <Descriptions.Item label={labelWithIcon(MapPin, "Branch")}>
              {decodeHTML(user.branchName) || "-"}
            </Descriptions.Item>
          </Descriptions>
        </div>

        {/* Additional information */}
        <div>
          <SectionLabel>Additional information</SectionLabel>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={labelWithIcon(Calendar, "Created date")}>
              {user.dateCreated
                ? dayjs(user.dateCreated).format("MMMM D, YYYY")
                : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="User ID">
              <span className="font-mono" style={{ fontSize: 12.5 }}>
                {user.id ?? "-"}
              </span>
            </Descriptions.Item>
          </Descriptions>
        </div>
      </div>
    </Modal>
  );
};

export default UserViewModal;
