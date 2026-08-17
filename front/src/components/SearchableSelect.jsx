import { Children, isValidElement, useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A dropdown you can type into — the standard shadcn combobox, composed from
 * `Popover` + `Command` (cmdk), both already installed. No new dependency.
 *
 * It is meant to be usable as *the* dropdown everywhere: the search box only
 * appears once a list is long enough to need one, so a four-option status
 * picker renders exactly like the `<Select>` it replaced while a 200-row user
 * list gains a filter. That removes the per-call-site judgement call, which is
 * the thing that goes stale as soon as someone adds a long dropdown.
 *
 * ── Drop-in: converting a call site is a rename ────────────────────────────
 *
 * It takes either an `options` array **or** the exact children a `<Select>`
 * already has. When children are given it walks them for the `<SelectItem>`s,
 * reads the placeholder off `<SelectValue>` and the trigger's `className` off
 * `<SelectTrigger>` (so `h-10 w-full` survives the conversion); the wrapper
 * elements themselves are not rendered.
 *
 *   <SearchableSelect value={field.value || undefined} onValueChange={field.onChange}>
 *     <SelectTrigger className="h-10 w-full"><SelectValue placeholder="Select role" /></SelectTrigger>
 *     <SelectContent>{roles.map(r => <SelectItem key={r.roleId} value={r.roleId}>{r.roleName}</SelectItem>)}</SelectContent>
 *   </SearchableSelect>
 *
 * Inside a react-hook-form field, wrap **this** component in `<FormControl>`
 * (not an inner `SelectTrigger`, which is discarded) — the extra props land on
 * the trigger button so the id/aria wiring still works.
 *
 * @param {Array<{value: string, label: string, hint?: string}>} [options]
 * @param {boolean} [searchable] - force the search box on/off; otherwise the list decides
 */

/**
 * Below this many options a filter box is noise — it costs a row of chrome and
 * a keystroke to narrow a list you can already read.
 */
const SEARCH_THRESHOLD = 12;

/** Flatten an element tree to its text, for an item's label. */
const textOf = (node) =>
  Children.toArray(node)
    .map((n) =>
      typeof n === "string" || typeof n === "number"
        ? String(n)
        : isValidElement(n)
          ? textOf(n.props?.children)
          : "",
    )
    .join("")
    .trim();

const SearchableSelect = ({
  options = [],
  searchable,
  value,
  onValueChange,
  placeholder = "Select…",
  searchPlaceholder = "Type to search…",
  emptyText = "Nothing matches that.",
  disabled = false,
  className,
  children,
  ...rest
}) => {
  const [open, setOpen] = useState(false);

  /**
   * Walk `<SelectItem>`s out of whatever children a converted `<Select>` had.
   * Recursive, because they sit inside `<SelectContent>` and often a
   * `<SelectGroup>` too — and a `.map()` produces an array child, which
   * `Children.toArray` flattens but does not descend into.
   */
  const fromChildren = useMemo(() => {
    if (!children) return null;
    const items = [];
    let ph;
    let triggerClassName;

    const walk = (nodes) => {
      Children.toArray(nodes).forEach((n) => {
        if (!isValidElement(n)) return;

        // Items are identified by carrying a `value` + children, not by
        // component identity — the import name varies and `displayName` isn't
        // reliable through the shadcn re-export.
        if (n.props?.value !== undefined && n.props?.children !== undefined) {
          items.push({
            value: String(n.props.value),
            label: textOf(n.props.children),
          });
          return;
        }

        if (n.props?.placeholder && ph === undefined) ph = n.props.placeholder;

        // A node whose direct children include the SelectValue is the trigger —
        // keep its className so the converted control keeps its height/width.
        const holdsPlaceholder = Children.toArray(n.props?.children).some(
          (c) => isValidElement(c) && c.props?.placeholder !== undefined,
        );
        if (holdsPlaceholder && triggerClassName === undefined) {
          triggerClassName = n.props?.className;
        }

        if (n.props?.children) walk(n.props.children);
      });
    };

    walk(children);
    return { items, placeholder: ph, triggerClassName };
  }, [children]);

  const opts = fromChildren?.items?.length ? fromChildren.items : options;
  const shownPlaceholder = fromChildren?.placeholder ?? placeholder;
  const selected = opts.find((o) => o.value === value) ?? null;
  // An explicit `searchable` always wins; otherwise the list decides.
  const showSearch = searchable ?? opts.length >= SEARCH_THRESHOLD;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        {/* `role="combobox"` + `aria-expanded` are what make this announce like
            the Select it replaces; cmdk gives the list its own roles. */}
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "h-10 w-full justify-between font-normal",
            fromChildren?.triggerClassName,
            className,
          )}
          {...rest}
        >
          <span
            className="truncate"
            style={{ color: selected ? undefined : "var(--color-text-muted)" }}
          >
            {selected ? selected.label : shownPlaceholder}
          </span>
          <ChevronsUpDown className="w-4 h-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        className="p-0 w-(--radix-popover-trigger-width)"
        align="start"
      >
        <Command
          // Match on the label and hint only — the item's `value` is a business
          // ID, and matching it would surface hits the reader can't see.
          // cmdk lower-cases the value it hands back here, so compare loosely.
          filter={(itemValue, search) => {
            const o = opts.find(
              (x) => x.value.toLowerCase() === itemValue.toLowerCase(),
            );
            const hay = `${o?.label ?? ""} ${o?.hint ?? ""}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          {showSearch && <CommandInput placeholder={searchPlaceholder} />}
          <CommandList>
            {/* Words, never a blank panel — and it names what happened, so the
                reader can tell a filtered list from a broken one. */}
            {showSearch && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {opts.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  // Emit the ORIGINAL value from the closure: cmdk normalises
                  // (lower-cases) the value it passes to onSelect, which would
                  // corrupt case-sensitive business IDs.
                  onSelect={() => {
                    onValueChange?.(o.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 w-4 h-4",
                      o.value === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="truncate">{o.label}</span>
                  {o.hint && (
                    <span
                      className="ml-auto pl-3 shrink-0"
                      style={{
                        fontSize: 12.5,
                        color: "var(--color-text-secondary)",
                      }}
                    >
                      {o.hint}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

export default SearchableSelect;
