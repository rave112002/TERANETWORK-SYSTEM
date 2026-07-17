import { memo } from "react";

/**
 * Page header — plain title + subtitle, with the page's primary action on the
 * right. No gradient chip, no icon tile: the title carries the page, and the
 * single inverted primary button carries the action.
 *
 * @param {string} title
 * @param {string} [subtitle]
 * @param {ReactNode} [actions] - usually <Button type="primary" icon={<PlusOutlined/>}>
 */
const PageHeader = ({ title, subtitle, actions }) => (
  <div className="flex items-start justify-between gap-4 flex-wrap">
    <div className="min-w-0">
      <h1
        className="m-0 font-semibold leading-tight"
        style={{
          fontSize: 26,
          letterSpacing: "-0.5px",
          color: "var(--color-text-dark)",
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <p
          className="m-0 mt-1"
          style={{ fontSize: 13.5, color: "var(--color-text-secondary)" }}
        >
          {subtitle}
        </p>
      )}
    </div>
    {actions && (
      <div className="flex items-center gap-2 shrink-0">{actions}</div>
    )}
  </div>
);

export default memo(PageHeader);
