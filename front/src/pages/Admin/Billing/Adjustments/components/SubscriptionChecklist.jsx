import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { decodeHTML } from "../../../../../utils/decode-html";

/**
 * Who an adjustment goes on — one subscription or hundreds.
 *
 * ── "Select all shown", not "select all" ────────────────────────────────────
 *
 * The header checkbox acts on what the search and plan filter leave visible.
 * That is how "credit everyone on Fiber 50" is two clicks, and it means the
 * checkbox never selects rows the clerk cannot see. Selections survive a change
 * of filter, so a list can be built up from several searches; the count beside
 * the checkbox is the whole selection, not just the visible part.
 *
 * @param {Object} props
 * @param {Array} props.options  rows from GET /adjustments/targets
 * @param {string[]} props.value selected subscriptionIds
 * @param {(ids: string[]) => void} props.onChange
 * @param {boolean} [props.isLoading]
 */
const SubscriptionChecklist = ({ options, value, onChange, isLoading = false }) => {
  const [search, setSearch] = useState("");
  const [planId, setPlanId] = useState("");

  const selected = useMemo(() => new Set(value), [value]);

  const plans = useMemo(() => {
    const byId = new Map();
    for (const o of options) {
      if (o.planId && !byId.has(o.planId)) byId.set(o.planId, decodeHTML(o.planName) || "Unnamed plan");
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [options]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return options.filter((o) => {
      if (planId && o.planId !== planId) return false;
      if (!term) return true;
      return (
        decodeHTML(o.customerName).toLowerCase().includes(term) ||
        String(o.accountNo).toLowerCase().includes(term)
      );
    });
  }, [options, search, planId]);

  const visibleSelected = visible.filter((o) => selected.has(o.subscriptionId)).length;
  const headerState =
    visible.length > 0 && visibleSelected === visible.length
      ? true
      : visibleSelected > 0
        ? "indeterminate"
        : false;

  const toggleAllShown = () => {
    const next = new Set(selected);
    if (headerState === true) {
      for (const o of visible) next.delete(o.subscriptionId);
    } else {
      for (const o of visible) next.add(o.subscriptionId);
    }
    onChange([...next]);
  };

  const toggleOne = (id) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange([...next]);
  };

  return (
    <div style={{ border: "1px solid var(--color-line)", borderRadius: 10 }} className="overflow-hidden">
      <div
        className="flex items-center gap-2 flex-wrap p-2.5"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div className="relative flex-1 min-w-40">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4"
            style={{ color: "var(--color-text-muted)" }}
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or account no…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={planId || "all"} onValueChange={(v) => setPlanId(v === "all" ? "" : v)}>
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All plans" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All plans</SelectItem>
            {plans.map(([id, name]) => (
              <SelectItem key={id} value={id}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div
        className="flex items-center justify-between gap-3 px-3 py-2"
        style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-surface-sunken)" }}
      >
        <label className="flex items-center gap-2.5 cursor-pointer" style={{ fontSize: 12.5 }}>
          <Checkbox
            checked={headerState}
            onCheckedChange={toggleAllShown}
            disabled={visible.length === 0}
            aria-label="Select all shown"
          />
          <span style={{ color: "var(--color-text-secondary)" }}>Select all shown ({visible.length})</span>
        </label>
        <div className="flex items-center gap-3" style={{ fontSize: 12.5 }}>
          <span style={{ color: "var(--color-text-dark)", fontWeight: 500 }}>{selected.size} selected</span>
          {selected.size > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="cursor-pointer hover:underline"
              style={{ color: "var(--color-link)" }}
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {isLoading ? (
          <p className="m-0 px-3 py-6 text-center" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            Loading subscriptions…
          </p>
        ) : visible.length === 0 ? (
          <p className="m-0 px-3 py-6 text-center" style={{ fontSize: 12.5, color: "var(--color-text-muted)" }}>
            {options.length === 0 ? "No active subscriptions found" : "No subscriptions match"}
          </p>
        ) : (
          visible.map((o) => (
            <label
              key={o.subscriptionId}
              className="flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors hover:bg-(--color-surface-sunken)"
              style={{ borderBottom: "1px solid var(--color-line)" }}
            >
              <Checkbox
                checked={selected.has(o.subscriptionId)}
                onCheckedChange={() => toggleOne(o.subscriptionId)}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 13, color: "var(--color-text-dark)" }}>
                  {decodeHTML(o.customerName) || o.accountNo}
                </span>
                <span className="block truncate" style={{ fontSize: 11.5, color: "var(--color-text-muted)" }}>
                  {o.accountNo} · {decodeHTML(o.planName) || "no plan"}
                </span>
              </span>
              {o.status === "suspended" && (
                <span style={{ fontSize: 11.5, color: "var(--color-error)" }}>Suspended</span>
              )}
            </label>
          ))
        )}
      </div>
    </div>
  );
};

export default SubscriptionChecklist;
