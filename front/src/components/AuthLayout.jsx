import dayjs from "dayjs";

import { loginBg } from "../assets/images";
import { teraWordmarkDark, teraWordmarkWhite } from "../assets/images/logos";

const PORTAL_LABEL = {
  admin: "Admin Portal",
  superadmin: "SuperAdmin Portal",
};

/**
 * Shared chrome for every auth page in both portals — login, forgot-password and
 * reset-password.
 *
 * Split screen: a full-bleed brand panel on the left (hidden below `lg`, where
 * there is no room for it) and the form on the right. Each page owns only what
 * sits *inside* the form column, so the six of them cannot drift apart the way
 * they would with a copy of this shell each.
 *
 * ── Two things worth knowing before editing ─────────────────────────────────
 *
 * 1. **The backdrop is a dark image in both themes.** So the wordmark and copy
 *    over it are white unconditionally — this is the one place white type is not
 *    a dark-mode bug. The form column uses the normal tokens and flips as usual.
 * 2. **The panel is decorative.** It carries no information the form column
 *    lacks, which is why it can vanish entirely on small screens; the wordmark
 *    reappears above the form there, in its dark colourway.
 */
const AuthLayout = ({ portal = "admin", children }) => (
  <div className="flex min-h-dvh w-full">
    {/* ── Brand panel ─────────────────────────────────────────────────── */}
    <div className="relative hidden lg:flex lg:w-1/2 xl:w-3/5">
      <img
        src={loginBg}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      />

      {/* Sits between the photo and the type: the image is dark overall but not
          uniformly, and the wordmark has to stay legible over the light band. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(160deg, rgb(0 0 0 / 0.55) 0%, rgb(0 0 0 / 0.30) 55%, rgb(0 0 0 / 0.65) 100%)",
        }}
      />

      <div className="relative z-10 flex h-full w-full flex-col justify-between p-12">
        <img
          src={teraWordmarkWhite}
          alt="TERANETWORK"
          className="h-11 w-fit"
          onContextMenu={(e) => e.preventDefault()}
          onDragStart={(e) => e.preventDefault()}
        />

        <div className="max-w-md">
          <h2
            className="m-0 font-semibold text-white"
            style={{ fontSize: 30, lineHeight: 1.2, letterSpacing: "-0.6px" }}
          >
            Network and billing, in one place.
          </h2>
          <p
            className="m-0 mt-3"
            style={{ fontSize: 14.5, color: "rgb(255 255 255 / 0.72)" }}
          >
            Fibre plant, subscribers, invoicing and service control — managed
            from a single console.
          </p>
        </div>
      </div>
    </div>

    {/* ── Form panel ──────────────────────────────────────────────────── */}
    <div
      className="flex w-full flex-col justify-center px-6 py-10 sm:px-12 lg:w-1/2 xl:w-2/5"
      style={{ background: "var(--color-surface)" }}
    >
      <div className="mx-auto w-full max-w-sm">
        {/* The brand panel is gone below `lg`, so the wordmark comes here
            instead. Two colourways: the dark one on a light surface, the white
            one once the theme flips. */}
        <div className="mb-8 lg:hidden">
          <img
            src={teraWordmarkDark}
            alt="TERANETWORK"
            className="h-10 w-fit dark:hidden"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
          <img
            src={teraWordmarkWhite}
            alt="TERANETWORK"
            className="hidden h-10 w-fit dark:block"
            onContextMenu={(e) => e.preventDefault()}
            onDragStart={(e) => e.preventDefault()}
          />
        </div>

        <div className="flex items-center gap-2 mb-5">
          <span
            className="inline-block"
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: "var(--color-link)",
            }}
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

        {children}

        <footer
          className="mt-10 text-center"
          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
        >
          {`© ${dayjs().year()} ${import.meta.env.VITE_APP_NAME || "TERANETWORK"}. All rights reserved.`}
        </footer>
      </div>
    </div>
  </div>
);

export default AuthLayout;
