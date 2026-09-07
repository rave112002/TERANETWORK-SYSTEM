import { useState } from "react";
import {
  Box,
  ChevronRight,
  CircleAlert,
  Router,
  Server,
  Split,
  Wifi,
} from "lucide-react";

/**
 * One node of the network topology tree.
 *
 * ── Why this is hand-rolled ─────────────────────────────────────────────────
 *
 * shadcn/ui has no tree primitive, and the alternative — pulling in a tree
 * library for one screen — would put a second component vocabulary into a
 * codebase whose conventions forbid exactly that. A recursive component over a
 * disclosure button is about forty lines, so it is built rather than installed.
 *
 * Accessibility comes from the ARIA tree pattern: the container is `role="tree"`
 * and every node is a `treeitem` carrying `aria-expanded` and `aria-level`, so
 * a screen reader announces depth and state that sighted users read from the
 * indentation.
 */

const ICONS = {
  olt: Server,
  ponPort: Wifi,
  splitter: Split,
  nap: Box,
  onu: Router,
  error: CircleAlert,
};

/** Only states worth colouring; everything else inherits the muted text token. */
const STATE_COLOR = {
  active: "var(--color-success)",
  suspended: "var(--color-error)",
  offline: "var(--color-warning)",
  full: "var(--color-warning)",
};

const TreeNode = ({ node, level = 1, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);

  const Icon = ICONS[node.kind] || Box;
  const hasChildren = node.children?.length > 0;
  const stateColor = STATE_COLOR[node.state];
  const isError = node.kind === "error";

  return (
    <li role="none">
      <div
        role="treeitem"
        aria-expanded={hasChildren ? open : undefined}
        aria-level={level}
        className="flex items-center gap-2 py-1.5 pr-2 rounded-md transition-colors hover:bg-(--color-surface-sunken)"
        style={{ paddingLeft: (level - 1) * 20 + 4 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-label={open ? `Collapse ${node.label}` : `Expand ${node.label}`}
            className="inline-flex items-center justify-center shrink-0 cursor-pointer"
            style={{ width: 18, height: 18, color: "var(--color-text-muted)" }}
          >
            <ChevronRight
              className="w-3.5 h-3.5 transition-transform"
              style={{ transform: open ? "rotate(90deg)" : "none" }}
            />
          </button>
        ) : (
          // Keeps leaves aligned with their expandable siblings.
          <span className="shrink-0" style={{ width: 18 }} />
        )}

        <Icon
          className="w-4 h-4 shrink-0"
          strokeWidth={1.8}
          style={{ color: isError ? "var(--color-error)" : "var(--color-text-muted)" }}
        />

        <span
          className="truncate"
          style={{
            fontSize: 13.5,
            fontWeight: node.kind === "olt" ? 600 : 400,
            color: isError ? "var(--color-error)" : "var(--color-text-dark)",
          }}
        >
          {node.label}
        </span>

        {node.meta && (
          <span
            className="font-mono shrink-0"
            style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}
          >
            {node.meta}
          </span>
        )}

        {stateColor && (
          <span
            className="shrink-0"
            title={node.state}
            style={{ width: 6, height: 6, borderRadius: "50%", background: stateColor }}
          />
        )}
      </div>

      {hasChildren && open && (
        <ul role="group" className="list-none m-0 p-0">
          {node.children.map((child) => (
            <TreeNode key={child.key} node={child} level={level + 1} />
          ))}
        </ul>
      )}
    </li>
  );
};

export default TreeNode;
