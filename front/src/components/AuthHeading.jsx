/**
 * Icon chip + title + subtitle at the top of an auth card.
 *
 * The chip is a **flat** hairline square with an accent-coloured glyph — not a
 * gradient fill. Per the design system a gradient icon chip is allowed in
 * exactly one place (the drawer form header); everywhere else structure comes
 * from borders and the accent is used sparingly.
 *
 * `centered` is the confirmation-screen variant ("Check your email", "Password
 * reset") — centred, and a step down in title size because those screens are a
 * short statement rather than the head of a form.
 */
const AuthHeading = ({ icon: Icon, title, subtitle, centered = false }) => (
  <div className={centered ? "text-center" : "mb-7"}>
    {Icon && (
      <span
        className="inline-flex items-center justify-center w-11 h-11 mb-4"
        style={{
          borderRadius: 12,
          background: "var(--color-surface-sunken)",
          border: "1px solid var(--color-line)",
        }}
      >
        <Icon
          className="w-5 h-5"
          strokeWidth={1.9}
          style={{ color: "var(--color-link)" }}
        />
      </span>
    )}

    <h1
      className="m-0 font-semibold leading-tight"
      style={{
        fontSize: centered ? 22 : 26,
        letterSpacing: centered ? "-0.4px" : "-0.5px",
        color: "var(--color-text-dark)",
      }}
    >
      {title}
    </h1>

    {subtitle && (
      <p
        className={centered ? "m-0 mt-2" : "m-0 mt-1"}
        style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
      >
        {subtitle}
      </p>
    )}
  </div>
);

export default AuthHeading;
