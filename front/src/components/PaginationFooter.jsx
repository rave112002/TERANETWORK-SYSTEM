import { Dropdown } from "antd";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";

/**
 * Custom pagination footer for list pages — replaces Ant's default pager
 * (tables must set `pagination={false}`). Renders inside the table card.
 *
 * @param {{current:number,pageSize:number,total:number}} pagination
 * @param {(p:{current:number,pageSize:number}) => void} onChange - the module's handleTableChange
 * @param {string} [noun] - singular noun, e.g. "role"
 * @param {string} [nounPlural] - defaults to `${noun}s`; pass for irregulars ("companies")
 */
const PaginationFooter = ({
  pagination,
  onChange,
  noun = "item",
  nounPlural,
}) => {
  const pgCurrent = pagination?.current || 1;
  const pgSize = pagination?.pageSize || 10;
  const pgTotal = pagination?.total || 0;
  const pgTotalPages = Math.max(1, Math.ceil(pgTotal / pgSize));
  const pgStart = pgTotal === 0 ? 0 : (pgCurrent - 1) * pgSize + 1;
  const pgEnd = Math.min(pgCurrent * pgSize, pgTotal);
  const plural = nounPlural || `${noun}s`;

  const goPage = (p) =>
    onChange({
      current: Math.min(Math.max(1, p), pgTotalPages),
      pageSize: pgSize,
    });

  return (
    <div className="flex items-center justify-between gap-3 flex-wrap px-5 py-3">
      <span className="text-[12.5px]" style={{ color: "var(--color-text-muted)" }}>
        {pgTotal === 0
          ? "No results"
          : `Showing ${pgStart}${pgEnd > pgStart ? `–${pgEnd}` : ""} of ${pgTotal} ${
              pgTotal === 1 ? noun : plural
            }`}
      </span>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1">
          <button
            onClick={() => goPage(pgCurrent - 1)}
            disabled={pgCurrent <= 1}
            className="pager-btn"
            aria-label="Previous page"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="pager-active">{pgCurrent}</div>
          <button
            onClick={() => goPage(pgCurrent + 1)}
            disabled={pgCurrent >= pgTotalPages}
            className="pager-btn"
            aria-label="Next page"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <Dropdown
          trigger={["click"]}
          menu={{
            items: [10, 20, 50, 100].map((n) => ({
              key: String(n),
              label: `${n} / page`,
              onClick: () => onChange({ current: 1, pageSize: n }),
            })),
          }}
        >
          <button className="pager-size">
            {pgSize} / page{" "}
            <ChevronsUpDown
              className="w-3 h-3"
              style={{ color: "var(--color-text-muted)" }}
            />
          </button>
        </Dropdown>
      </div>
    </div>
  );
};

export default PaginationFooter;
