import { Demo, DemoNote, Section } from "./Showcase";

const SURFACES = [
  { token: "--color-canvas", label: "Page background" },
  { token: "--color-surface", label: "Cards, table, drawer" },
  { token: "--color-surface-sunken", label: "Wells, hover, tracks" },
  { token: "--color-line", label: "Hairline borders" },
  { token: "--color-line-soft", label: "Row dividers" },
];

const TEXT = [
  { token: "--color-text-dark", label: "Primary text / values" },
  { token: "--color-text2", label: "Mid text" },
  { token: "--color-text-secondary", label: "Body / labels" },
  { token: "--color-text-muted", label: "Captions, icons, units" },
];

const ACCENT = [
  { token: "--color-secondary-color", label: "Accent — bars, ticks, chips" },
  { token: "--color-link", label: "Text links" },
  { token: "--chart-series-1", label: "Chart series" },
];

const STATUS = [
  { token: "--color-success", label: "Success" },
  { token: "--color-warning", label: "Warning" },
  { token: "--color-error", label: "Error" },
];

const Swatch = ({ token, label }) => (
  <div className="flex items-center gap-3">
    <span
      className="shrink-0"
      style={{
        width: 34,
        height: 34,
        borderRadius: 9,
        background: `var(${token})`,
        border: "1px solid var(--color-line)",
      }}
    />
    <div className="min-w-0">
      <p
        className="m-0 font-mono truncate"
        style={{ fontSize: 11.5, color: "var(--color-text-dark)" }}
      >
        {token}
      </p>
      <p
        className="m-0 truncate"
        style={{ fontSize: 12, color: "var(--color-text-secondary)" }}
      >
        {label}
      </p>
    </div>
  </div>
);

const SwatchGrid = ({ items }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
    {items.map((s) => (
      <Swatch key={s.token} {...s} />
    ))}
  </div>
);

const FoundationsSection = () => (
  <Section
    id="foundations"
    title="Foundations"
    description="Every colour, radius and type step is a token in src/index.css — pages never hardcode a hex, which is what makes dark mode free."
  >
    <Demo name="Surfaces & lines" source="index.css · @theme">
      <SwatchGrid items={SURFACES} />
    </Demo>

    <Demo name="Text" source="index.css · @theme">
      <SwatchGrid items={TEXT} />
    </Demo>

    <Demo name="Accent & charts" source="index.css · @theme">
      <SwatchGrid items={ACCENT} />
      <DemoNote>
        The accent is for bars, ticks, focus rings and chips — never a button
        fill.
      </DemoNote>
    </Demo>

    <Demo name="Status" source="index.css · @theme">
      <SwatchGrid items={STATUS} />
      <DemoNote>Status colours stay constant across light and dark.</DemoNote>
    </Demo>

    <Demo name="Type scale" source="Onest · JetBrains Mono">
      <div className="space-y-3">
        <p
          className="m-0"
          style={{
            fontSize: 26,
            fontWeight: 600,
            letterSpacing: "-0.5px",
            color: "var(--color-text-dark)",
          }}
        >
          Page title — 26 / 600
        </p>
        <p
          className="m-0"
          style={{
            fontSize: 30,
            fontWeight: 600,
            lineHeight: 1.1,
            letterSpacing: "-0.5px",
            color: "var(--color-text-dark)",
          }}
        >
          1,284
        </p>
        <p
          className="m-0"
          style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
        >
          Body — 13.5 / 400. The reading size for descriptions, table cells and
          form labels.
        </p>
        <p
          className="m-0 uppercase"
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: "var(--color-text-muted)",
          }}
        >
          Micro label — 11 / 600
        </p>
        <p
          className="m-0 font-mono"
          style={{ fontSize: 12, color: "var(--color-text-muted)" }}
        >
          01 · JetBrains Mono — ids and row numbers only
        </p>
      </div>
    </Demo>

    <Demo name="Radii & elevation" source="--radius-card · --radius-control">
      <div className="flex flex-wrap items-end gap-3.5">
        {[
          { r: "var(--radius-card)", label: "card · 14" },
          { r: "var(--radius-control)", label: "control · 9" },
          { r: "9999px", label: "pill" },
        ].map((x) => (
          <div key={x.label} className="text-center">
            <div
              style={{
                width: 84,
                height: 56,
                borderRadius: x.r,
                background: "var(--color-surface-sunken)",
                border: "1px solid var(--color-line)",
              }}
            />
            <p
              className="m-0 mt-1.5"
              style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
            >
              {x.label}
            </p>
          </div>
        ))}
      </div>
      <DemoNote>
        Structure comes from hairline borders, not shadows — shadows only appear
        on floating layers (dropdown, dialog, sheet).
      </DemoNote>
    </Demo>
  </Section>
);

export default FoundationsSection;
