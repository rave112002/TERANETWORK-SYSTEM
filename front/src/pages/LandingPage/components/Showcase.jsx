import { cn } from "@/lib/utils";

/**
 * Layout primitives for the component gallery on the landing page.
 *
 * `Section` is one titled group of demos; `Demo` is the bordered card a single
 * component is previewed in — name on the left, its import path in mono on the
 * right, so the preview doubles as a lookup table.
 *
 * `scroll-mt-16` keeps a section heading clear of the sticky nav on an anchor
 * jump; it has to stay under the nav's active-section threshold (NAV_OFFSET + 8
 * in LandingPage/index.jsx) or the clicked link wouldn't light up.
 */
export const Section = ({ id, title, description, children }) => (
  <section id={id} className="scroll-mt-16">
    <div className="mb-4">
      <h2
        className="m-0 font-semibold leading-tight"
        style={{
          fontSize: 19,
          letterSpacing: "-0.3px",
          color: "var(--color-text-dark)",
        }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="m-0 mt-1"
          style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
        >
          {description}
        </p>
      )}
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">{children}</div>
  </section>
);

export const Demo = ({ name, source, wide = false, children }) => (
  <div
    className={cn("bg-surface", wide && "lg:col-span-2")}
    style={{
      border: "1px solid var(--color-line)",
      borderRadius: "var(--radius-card)",
    }}
  >
    <div
      className="flex items-center justify-between gap-3 px-4.5 py-3"
      style={{ borderBottom: "1px solid var(--color-line)" }}
    >
      <span
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: "var(--color-text-dark)",
        }}
      >
        {name}
      </span>
      {source && (
        <span
          className="font-mono truncate"
          style={{ fontSize: 11, color: "var(--color-text-muted)" }}
        >
          {source}
        </span>
      )}
    </div>
    <div className="p-4.5">{children}</div>
  </div>
);

/** A muted caption under a row of variants. */
export const DemoNote = ({ children }) => (
  <p
    className="m-0 mt-3"
    style={{ fontSize: 12, color: "var(--color-text-muted)" }}
  >
    {children}
  </p>
);

/** Label above a single row of variants inside a demo card. */
export const DemoRow = ({ label, children, className }) => (
  <div className={cn("mb-4 last:mb-0", className)}>
    {label && (
      <p
        className="m-0 mb-2 uppercase"
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </p>
    )}
    <div className="flex flex-wrap items-center gap-2.5">{children}</div>
  </div>
);
