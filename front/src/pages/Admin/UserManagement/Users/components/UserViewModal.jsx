import { Briefcase, Calendar, Mail, MapPin, Phone, User } from "lucide-react";
import dayjs from "dayjs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SectionLabel from "../../../../../components/SectionLabel";
import DescriptionList from "../../../../../components/DescriptionList";
import { decodeHTML } from "../../../../../utils/decode-html";
import { formatPhoneDisplay } from "../../../../../utils/phoneFormat";

const labelWithIcon = (Icon, text) => (
  <span className="inline-flex items-center gap-2">
    <Icon className="w-4 h-4" style={{ color: "var(--color-text-muted)" }} />
    {text}
  </span>
);

const mono = (v) => (
  <span className="font-mono" style={{ fontSize: 12.5 }}>
    {v}
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
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="sm:max-w-160">
        <DialogHeader>
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
                  width={56}
                  height={56}
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                initial
              )}
            </span>
            <div className="min-w-0 text-left">
              <DialogTitle
                className="truncate leading-tight"
                style={{ fontSize: 16, color: "var(--color-text-dark)" }}
              >
                {name}
              </DialogTitle>
              <div
                className="font-normal"
                style={{ fontSize: 12.5, color: "var(--color-text-secondary)" }}
              >
                User details
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 space-y-7">
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
            <DescriptionList
              items={[
                {
                  label: labelWithIcon(User, "Full name"),
                  value: name || "-",
                },
                { label: "Account ID", value: mono(user.accountId || "-") },
                {
                  label: labelWithIcon(Mail, "Email"),
                  value: decodeHTML(user.email) || "-",
                },
                {
                  label: labelWithIcon(Phone, "Phone"),
                  value: formatPhoneDisplay(decodeHTML(user.phone)) || "-",
                },
              ]}
            />
          </div>

          {/* Work information */}
          <div>
            <SectionLabel>Work information</SectionLabel>
            <DescriptionList
              items={[
                {
                  label: labelWithIcon(Briefcase, "Role"),
                  value: decodeHTML(user.roleName) || "No role",
                },
                {
                  label: labelWithIcon(MapPin, "Branch"),
                  value: decodeHTML(user.branchName) || "-",
                },
              ]}
            />
          </div>

          {/* Additional information */}
          <div>
            <SectionLabel>Additional information</SectionLabel>
            <DescriptionList
              items={[
                {
                  label: labelWithIcon(Calendar, "Created date"),
                  value: user.dateCreated
                    ? dayjs(user.dateCreated).format("MMMM D, YYYY")
                    : "-",
                },
                { label: "User ID", value: mono(user.id ?? "-") },
              ]}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserViewModal;
