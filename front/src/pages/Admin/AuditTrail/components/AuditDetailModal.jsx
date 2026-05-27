import { Descriptions, Modal, Tag } from "antd";
import dayjs from "dayjs";
import { FileText } from "lucide-react";

const ACTION_COLORS = {
  CREATE: "success",
  UPDATE: "processing",
  DELETE: "error",
};

// metadata is a JSON column — mysql2 may return it as a parsed object or a string.
const parseMetadata = (metadata) => {
  if (!metadata) return null;
  if (typeof metadata === "object") return metadata;
  try {
    return JSON.parse(metadata);
  } catch {
    return metadata; // not valid JSON — show the raw string
  }
};

const AuditDetailModal = ({ open, onClose, log }) => {
  if (!log) return null;

  const meta = parseMetadata(log.metadata);
  const userName =
    [log.firstName, log.lastName].filter(Boolean).join(" ") ||
    log.accountId ||
    "—";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={640}
      title={
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-xl"
            style={{ background: "var(--gradient-primary)" }}
          >
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2
              className="text-lg font-bold"
              style={{ color: "var(--color-text-dark)" }}
            >
              Audit Event
            </h2>
            <p
              className="text-sm"
              style={{ color: "var(--color-text-secondary)" }}
            >
              {dayjs(log.dateCreated).format("MMM D, YYYY h:mm:ss A")}
            </p>
          </div>
        </div>
      }
    >
      <Descriptions column={1} bordered size="small" className="mt-4">
        <Descriptions.Item label="Action">
          <Tag color={ACTION_COLORS[log.action] || "default"}>{log.action}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Module">{log.module}</Descriptions.Item>
        <Descriptions.Item label="User">{userName}</Descriptions.Item>
        <Descriptions.Item label="Description">
          {log.description || "—"}
        </Descriptions.Item>
        <Descriptions.Item label="IP Address">
          {log.ipAddress || "—"}
        </Descriptions.Item>
      </Descriptions>

      {meta && (
        <div className="mt-4">
          <p
            className="text-xs font-semibold uppercase tracking-wide mb-2"
            style={{ color: "var(--color-text-secondary)" }}
          >
            Metadata
          </p>
          <pre
            className="rounded-xl p-4 text-xs overflow-auto max-h-72 whitespace-pre-wrap break-words"
            style={{
              background: "var(--color-surface-sunken)",
              color: "var(--color-text-dark)",
            }}
          >
            {typeof meta === "string" ? meta : JSON.stringify(meta, null, 2)}
          </pre>
        </div>
      )}
    </Modal>
  );
};

export default AuditDetailModal;
