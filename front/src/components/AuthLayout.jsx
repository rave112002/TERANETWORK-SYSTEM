import dayjs from "dayjs";
import { ShieldCheck } from "lucide-react";

const PORTAL_LABEL = {
  admin: "Admin Portal",
  superadmin: "SuperAdmin Portal",
};

/**
 * Shared chrome for every auth page in both portals — login, forgot-password
 * and reset-password: canvas → portal label → card → copyright.
 *
 * Each page owns only what sits *inside* the card, so the four of them can't
 * drift apart the way they did while each carried its own copy of this shell.
 */
const AuthLayout = ({ portal = "admin", children }) => (
  <div
    className="flex min-h-screen items-center justify-center px-4 py-10"
    style={{ background: "var(--color-canvas)" }}
  >
    <div className="w-full max-w-md">
      {/* Portal label */}
      <div className="flex items-center justify-center gap-2 mb-5">
        <ShieldCheck
          className="w-3.5 h-3.5"
          style={{ color: "var(--color-text-muted)" }}
        />
        <span
          className="uppercase"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--color-text-muted)",
          }}
        >
          {PORTAL_LABEL[portal] ?? PORTAL_LABEL.admin}
        </span>
      </div>

      {/* Card */}
      <div
        className="p-8"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
        }}
      >
        {children}
      </div>

      {/* Copyright */}
      <footer
        className="text-center mt-6 px-2"
        style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}
      >
        {`© ${dayjs().year()} ${import.meta.env.VITE_APP_NAME || "Your Company"}.`}
        <br />
        All rights reserved.
      </footer>
    </div>
  </div>
);

export default AuthLayout;
