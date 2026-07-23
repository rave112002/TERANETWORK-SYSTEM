import { Button, Modal } from "antd";
import { Building2, Pencil, X } from "lucide-react";
import dayjs from "dayjs";
import SectionLabel from "../../../../components/SectionLabel";
import { decodeHTML } from "../../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../../utils/phoneFormat";

// Status → dot colour. Mirrors the list table's status column.
const STATUS_DOT = {
  Active: "var(--color-success)",
  Pending: "var(--color-warning)",
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
      style={{
        fontSize: mono ? 12.5 : 13.5,
        color: "var(--color-text-dark)",
      }}
    >
      {value || "-"}
    </span>
  </div>
);

// Flat metric well — no pastel tint, no shadow.
const MetricWell = ({ label, value }) => (
  <div
    className="p-4"
    style={{
      background: "var(--color-surface-sunken)",
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}>
      {label}
    </div>
    <div
      className="mt-1.5"
      style={{
        fontSize: 24,
        fontWeight: 600,
        lineHeight: 1.1,
        letterSpacing: "-0.5px",
        color: "var(--color-text-dark)",
      }}
    >
      {value}
    </div>
  </div>
);

const ViewCompanyModal = ({ open, onClose, company, onEdit }) => {
  if (!company) return null;

  const name = decodeHTML(company.name) || "";
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const active = company.status === "Active";

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
              onClick={() => onEdit(company)}
              size="large"
            >
              Edit company
            </Button>
          )}
        </div>
      }
    >
      {/* Header — logo/accent chip + title + subtitle + bordered X */}
      <div className="flex items-start justify-between gap-3 mb-7">
        <div className="flex items-center gap-3 min-w-0">
          {company.logo ? (
            <span
              className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 overflow-hidden"
              style={{
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
              }}
            >
              <img
                src={company.logo}
                alt=""
                className="w-full h-full object-cover"
                width={56}
                height={56}
                loading="lazy"
                decoding="async"
              />
            </span>
          ) : (
            <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-(image:--gradient-primary)">
              <Building2 className="w-[22px] h-[22px] text-white" />
            </span>
          )}
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
              Company details
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

      {/* Status + plan */}
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
                STATUS_DOT[company.status] || "var(--color-text-muted)",
              boxShadow: active ? "0 0 8px rgba(34,197,94,.5)" : "none",
            }}
          />
          {company.status || "Unknown"}
        </span>
        <span style={{ fontSize: 13, color: "var(--color-text-muted)" }}>
          {company.subscriptionPlan || "No plan"}
        </span>
      </div>

      {/* Company details */}
      <div>
        <SectionLabel>Company details</SectionLabel>
        <DetailRow label="Company name" value={name} />
        <DetailRow label="Email" value={company.email} />
        <DetailRow label="Phone" value={formatPhoneDisplay(company.phone)} />
        <DetailRow
          label="Website"
          value={
            company.website ? (
              <a
                href={company.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--color-link)" }}
              >
                {company.website}
              </a>
            ) : null
          }
        />
      </div>

      {/* Usage */}
      <div className="mt-7">
        <SectionLabel>Usage</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <MetricWell label="Branches" value={company.branches ?? 0} />
          <MetricWell label="Staff members" value={company.staff ?? 0} />
        </div>
      </div>

      {/* Record */}
      <div className="mt-7">
        <SectionLabel>Record</SectionLabel>
        <DetailRow
          label="Created"
          value={
            company.createdAt
              ? dayjs(company.createdAt).format("MMM D, YYYY")
              : null
          }
        />
        <DetailRow label="Company ID" value={company.id} mono />
      </div>
    </Modal>
  );
};

export default ViewCompanyModal;
