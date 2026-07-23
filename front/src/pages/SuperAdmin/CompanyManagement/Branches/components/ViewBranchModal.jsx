import { Button, Modal } from "antd";
import { MapPin, Pencil, X } from "lucide-react";
import dayjs from "dayjs";
import SectionLabel from "../../../../../components/SectionLabel";
import { decodeHTML } from "../../../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../../../utils/phoneFormat";

// Status → dot colour. Mirrors the list table's status column.
const STATUS_DOT = {
  Active: "var(--color-success)",
  Suspended: "var(--color-warning)",
  Inactive: "var(--color-text-muted)",
  Deleted: "var(--color-text-muted)",
};

// Label / value row — hairline separated, no bordered Descriptions table.
const DetailRow = ({ label, value, mono }) => (
  <div
    className="flex items-start justify-between gap-4 py-2.5"
    style={{ borderBottom: "1px solid var(--color-line-soft)" }}
  >
    <span
      className="shrink-0"
      style={{ fontSize: 13, color: "var(--color-text-muted)" }}
    >
      {label}
    </span>
    <span
      className={`min-w-0 text-right break-words ${mono ? "font-mono" : ""}`}
      style={{ fontSize: mono ? 12.5 : 13.5, color: "var(--color-text-dark)" }}
    >
      {value || "-"}
    </span>
  </div>
);

const ViewBranchModal = ({ open, onClose, branch, onEdit }) => {
  if (!branch) return null;

  const name = decodeHTML(branch.name) || "";
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const active = branch.status === "Active";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={640}
      closable={false}
      title={null}
      footer={
        <div
          className="pt-4 flex justify-end gap-3"
          style={{ borderTop: "1px solid var(--color-line)" }}
        >
          <Button onClick={onClose} size="large">
            Close
          </Button>
          {onEdit && (
            <Button
              type="primary"
              icon={<Pencil className="w-4 h-4" />}
              onClick={() => onEdit(branch)}
              size="large"
            >
              Edit branch
            </Button>
          )}
        </div>
      }
    >
      {/* Header — accent chip + title + subtitle + bordered X */}
      <div className="flex items-start justify-between gap-3 mb-7">
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
            <MapPin className="w-[22px] h-[22px] text-white" />
          </span>
          <div className="min-w-0">
            <h2
              className="m-0 font-semibold leading-tight truncate"
              style={{ fontSize: 19, color: "var(--color-text-dark)" }}
            >
              {name || initial}
            </h2>
            <p
              className="m-0 mt-0.5"
              style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
            >
              Branch details
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
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

      {/* Status + main-branch marker */}
      <div className="flex items-center gap-5 mb-7">
        <span
          className="inline-flex items-center gap-2"
          style={{ fontSize: 13, color: "var(--color-text-secondary)" }}
        >
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background:
                STATUS_DOT[branch.status] || "var(--color-text-muted)",
              boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
            }}
          />
          {branch.status || "Unknown"}
        </span>
        {branch.isMainBranch ? (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 600,
              letterSpacing: "0.04em",
              lineHeight: 1.6,
              padding: "0 6px",
              borderRadius: 5,
              border: "1px solid var(--color-line)",
              color: "var(--color-text-muted)",
            }}
          >
            MAIN
          </span>
        ) : null}
      </div>

      {/* Branch details */}
      <div>
        <SectionLabel>Branch details</SectionLabel>
        <DetailRow label="Branch name" value={name} />
        <DetailRow label="Company" value={decodeHTML(branch.companyName)} />
        <DetailRow label="Email" value={decodeHTML(branch.email)} />
        <DetailRow
          label="Phone"
          value={formatPhoneDisplay(decodeHTML(branch.phone))}
        />
        <DetailRow label="Address" value={decodeHTML(branch.address)} />
      </div>

      {/* Record */}
      <div className="mt-7">
        <SectionLabel>Record</SectionLabel>
        <DetailRow
          label="Created"
          value={
            branch.dateCreated
              ? dayjs(branch.dateCreated).format("MMM D, YYYY")
              : null
          }
        />
        <DetailRow label="Branch ID" value={branch.branchId} mono />
      </div>
    </Modal>
  );
};

export default ViewBranchModal;
