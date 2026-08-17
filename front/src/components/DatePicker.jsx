import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * A calendar date picker themed with the Modern tokens.
 *
 * It is a DROP-IN for `<Input type="date">` / `<Input type="datetime-local">` —
 * the value it reads and the value it emits are the exact same strings those
 * inputs use (`YYYY-MM-DD`, `YYYY-MM-DDTHH:mm`), and `onChange` receives a
 * synthetic `{ target: { name, value } }` so both call styles keep working:
 * react-hook-form's `{...field}` spread AND `onChange={(e) => set(e.target.value)}`.
 * Swapping a call site is a rename, never a value-shape change.
 *
 * Dates are built and formatted with LOCAL getters only — a `YYYY-MM-DD` out of
 * MySQL carries no timezone, and `new Date("2026-06-01")` parses it as UTC,
 * which shifts it a day for anyone west of Greenwich.
 *
 * @param {string}   [value]    `YYYY-MM-DD`, or `YYYY-MM-DDTHH:mm` when `showTime`.
 * @param {Function} [onChange] Receives a synthetic change event.
 * @param {boolean}  [showTime] Adds the hour/minute columns and the OK footer.
 * @param {string}   [min]      Earliest selectable date (`YYYY-MM-DD` prefix is enough).
 * @param {string}   [max]      Latest selectable date.
 */

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const CELL = 36; // day-cell footprint (the grid is 7 of these wide)
const TIME_ITEM = 28;
const TIME_LIST_HEIGHT = 244; // matches weekday row + 6 day rows

const pad2 = (n) => String(n).padStart(2, "0");

/** Local `Date` → `YYYY-MM-DD`. Never `toISOString()` — that converts to UTC. */
const toYMD = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

const isYMD = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isHM = (s) => /^([01]\d|2\d):[0-5]\d$/.test(s);

/** `2026-06-01T08:30` → `{ date: "2026-06-01", time: "08:30" }`, either may be "". */
const splitValue = (v) => {
  const raw = String(v ?? "").trim();
  if (!raw) return { date: "", time: "" };
  const [datePart, timePart = ""] = raw.replace(" ", "T").split("T");
  return {
    date: isYMD(datePart) ? datePart : "",
    time: isHM(timePart.slice(0, 5)) ? timePart.slice(0, 5) : "",
  };
};

const DatePicker = ({
  ref,
  value = "",
  onChange,
  onBlur,
  name,
  showTime = false,
  min,
  max,
  placeholder,
  disabled = false,
  allowClear = true,
  className,
  align = "start",
  ...rest
}) => {
  const format = showTime ? "YYYY-MM-DD HH:mm" : "YYYY-MM-DD";
  const { date: selectedDate, time: selectedTime } = splitValue(value);
  const minDay = String(min ?? "").slice(0, 10);
  const maxDay = String(max ?? "").slice(0, 10);
  const today = useMemo(() => toYMD(new Date()), []);

  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("date"); // date | month | year
  // Non-null only while the user is mid-keystroke; the committed value owns the
  // box the rest of the time. Derived, not synced — no effect to fall out of date.
  const [draft, setDraft] = useState(null);

  // The month the panel is showing — independent of the selection, because a
  // user browsing to March hasn't picked anything yet.
  const anchorDay = selectedDate || today;
  const [view, setView] = useState(() => ({
    year: Number(anchorDay.slice(0, 4)),
    month: Number(anchorDay.slice(5, 7)) - 1,
  }));

  const inputRef = useRef(null);
  const hourListRef = useRef(null);
  const minuteListRef = useRef(null);

  const setRefs = (el) => {
    inputRef.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };

  const display = selectedDate
    ? showTime
      ? `${selectedDate} ${selectedTime || "00:00"}`
      : selectedDate
    : "";

  const text = draft ?? display;

  // Re-point the panel at the selection every time it opens, so reopening after
  // browsing away doesn't strand the user in an unrelated month.
  const openPanel = () => {
    setMode("date");
    setView({
      year: Number(anchorDay.slice(0, 4)),
      month: Number(anchorDay.slice(5, 7)) - 1,
    });
    setOpen(true);
  };

  // Park the chosen hour/minute at the top of its column.
  useEffect(() => {
    if (!open || !showTime) return;
    const [hh, mm] = (selectedTime || "00:00").split(":");
    const scroll = (el, index) => {
      if (el) el.scrollTop = index * TIME_ITEM;
    };
    const id = requestAnimationFrame(() => {
      scroll(hourListRef.current, Number(hh));
      scroll(minuteListRef.current, Number(mm));
    });
    return () => cancelAnimationFrame(id);
  }, [open, showTime, selectedTime]);

  const emit = (next) => {
    onChange?.({ target: { name, value: next }, type: "change" });
  };

  const isDayDisabled = (day) =>
    (minDay && day < minDay) || (maxDay && day > maxDay);

  const commitDay = (day, { close } = {}) => {
    if (isDayDisabled(day)) return;
    emit(showTime ? `${day}T${selectedTime || "00:00"}` : day);
    if (close ?? !showTime) setOpen(false);
  };

  const commitTime = (time) => {
    const day = selectedDate || today;
    if (isDayDisabled(day)) return;
    emit(`${day}T${time}`);
  };

  const handleTextChange = (e) => {
    const next = e.target.value;
    setDraft(next);
    const { date, time } = splitValue(next);
    if (!next.trim()) {
      emit("");
      return;
    }
    if (!date || isDayDisabled(date)) return;
    if (showTime) {
      if (time) emit(`${date}T${time}`);
    } else if (next.trim().length === 10) {
      emit(date);
    }
  };

  const handleBlur = (e) => {
    setDraft(null); // an unparseable half-typed date snaps back to the value
    onBlur?.(e);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      setDraft(null);
      setOpen(false);
      return;
    }
    if (!open && (e.key === "ArrowDown" || e.key === " ")) {
      e.preventDefault();
      openPanel();
    }
  };

  const clear = (e) => {
    e.stopPropagation();
    setDraft(null);
    emit("");
    inputRef.current?.focus();
  };

  const shiftView = (years, months) => {
    const d = new Date(view.year + years, view.month + months, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  // Always 42 cells: leading/trailing days keep the panel from resizing between
  // a 4-row February and a 6-row month.
  const grid = useMemo(() => {
    const offset = new Date(view.year, view.month, 1).getDay();
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(view.year, view.month, 1 - offset + i);
      return { key: toYMD(d), day: d.getDate(), month: d.getMonth() };
    });
  }, [view]);

  const decadeStart = Math.floor(view.year / 10) * 10;

  // ── panel pieces ─────────────────────────────────────────────────────────
  const navBtn = (key, label, icon, onClick) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors hover:bg-(--color-surface-sunken)"
      style={{ color: "var(--color-text-muted)" }}
    >
      {icon}
    </button>
  );

  const headerLabelBtn = (label, onClick) => (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-1.5 py-0.5 transition-colors hover:bg-(--color-surface-sunken)"
      style={{
        fontSize: 13.5,
        fontWeight: 500,
        color: "var(--color-text-dark)",
      }}
    >
      {label}
    </button>
  );

  const cellStyle = (state) => ({
    fontSize: 13,
    borderRadius: 8,
    background: state.selected
      ? "var(--color-btn-bg)"
      : state.today
        ? "var(--color-surface-sunken)"
        : "transparent",
    color: state.selected
      ? "var(--color-btn-text)"
      : state.outside
        ? "var(--color-text-muted)"
        : "var(--color-text-dark)",
    border:
      state.today && !state.selected
        ? "1px solid var(--color-secondary-color)"
        : "1px solid transparent",
    fontWeight: state.selected ? 600 : 400,
    opacity: state.disabled ? 0.35 : 1,
    cursor: state.disabled ? "not-allowed" : "pointer",
  });

  const timeColumn = (kind, items, active, onPick, listRef) => (
    <div
      className="flex flex-col"
      style={{ borderLeft: "1px solid var(--color-line)" }}
    >
      <div
        className="flex items-center justify-center uppercase"
        style={{
          height: 28,
          fontSize: 11,
          letterSpacing: "0.06em",
          color: "var(--color-text-muted)",
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        {kind}
      </div>
      <div
        ref={listRef}
        data-scroll-list=""
        className="overflow-y-auto"
        style={{
          height: TIME_LIST_HEIGHT - 28,
          width: 56,
          scrollbarWidth: "thin",
        }}
      >
        {items.map((item) => {
          const isActive = item === active;
          return (
            <button
              key={item}
              type="button"
              onClick={() => onPick(item)}
              className="flex w-full items-center justify-center transition-colors hover:bg-(--color-surface-sunken)"
              style={{
                height: TIME_ITEM,
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                background: isActive
                  ? "var(--color-surface-sunken)"
                  : "transparent",
                color: isActive
                  ? "var(--color-text-dark)"
                  : "var(--color-text-secondary)",
              }}
            >
              {item}
            </button>
          );
        })}
        {/* Lets the last entry scroll to the top like the others. */}
        <div style={{ height: TIME_LIST_HEIGHT - 28 - TIME_ITEM }} />
      </div>
    </div>
  );

  const [selHour, selMinute] = (selectedTime || "").split(":");

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverAnchor asChild>
        <div
          onPointerDown={() => {
            if (!disabled && !open) openPanel();
          }}
          className={cn(
            "group flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] md:text-sm dark:bg-input/30",
            "focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
            "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-destructive/20 dark:has-[input[aria-invalid=true]]:ring-destructive/40",
            disabled && "pointer-events-none cursor-not-allowed opacity-50",
            className,
          )}
        >
          <input
            ref={setRefs}
            name={name}
            value={text}
            onChange={handleTextChange}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={placeholder || format}
            autoComplete="off"
            className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            style={{ color: "var(--color-text-dark)" }}
            {...rest}
          />
          {allowClear && display && !disabled ? (
            <button
              type="button"
              tabIndex={-1}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={clear}
              aria-label="Clear date"
              className="hidden shrink-0 group-hover:inline-flex"
              style={{ color: "var(--color-text-muted)" }}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
          <Calendar
            className={cn(
              "h-4 w-4 shrink-0",
              allowClear && display && !disabled && "group-hover:hidden",
            )}
            style={{ color: "var(--color-text-muted)" }}
          />
        </div>
      </PopoverAnchor>

      <PopoverContent
        align={align}
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
        // Keep the caret in the input while clicking around the panel — losing
        // focus mid-pick would fire the field's blur validation on every cell.
        // The time columns are exempt so their scrollbars can still be dragged.
        onMouseDown={(e) => {
          if (e.target?.dataset?.scrollList === undefined) e.preventDefault();
        }}
        className="w-auto overflow-hidden p-0"
        style={{
          border: "1px solid var(--color-line)",
          borderRadius: "var(--radius-card)",
          background: "var(--color-surface-raised)",
        }}
      >
        {/* header */}
        <div
          className="flex items-center justify-between px-2"
          style={{ height: 40, borderBottom: "1px solid var(--color-line)" }}
        >
          <div className="flex items-center gap-0.5">
            {navBtn(
              "prev-year",
              "Previous year",
              <ChevronsLeft className="h-3.5 w-3.5" />,
              () => (mode === "year" ? shiftView(-10, 0) : shiftView(-1, 0)),
            )}
            {mode === "date" &&
              navBtn(
                "prev-month",
                "Previous month",
                <ChevronLeft className="h-3.5 w-3.5" />,
                () => shiftView(0, -1),
              )}
          </div>

          <div className="flex items-center gap-1">
            {mode === "date" && (
              <>
                {headerLabelBtn(MONTHS_SHORT[view.month], () =>
                  setMode("month"),
                )}
                {headerLabelBtn(view.year, () => setMode("year"))}
              </>
            )}
            {mode === "month" &&
              headerLabelBtn(view.year, () => setMode("year"))}
            {mode === "year" && (
              <span
                style={{
                  fontSize: 13.5,
                  fontWeight: 500,
                  color: "var(--color-text-dark)",
                }}
              >
                {decadeStart}–{decadeStart + 9}
              </span>
            )}
          </div>

          <div className="flex items-center gap-0.5">
            {mode === "date" &&
              navBtn(
                "next-month",
                "Next month",
                <ChevronRight className="h-3.5 w-3.5" />,
                () => shiftView(0, 1),
              )}
            {navBtn(
              "next-year",
              "Next year",
              <ChevronsRight className="h-3.5 w-3.5" />,
              () => (mode === "year" ? shiftView(10, 0) : shiftView(1, 0)),
            )}
          </div>
        </div>

        {/* body */}
        <div className="flex">
          <div className="p-2">
            {mode === "date" && (
              <>
                <div className="flex">
                  {WEEKDAYS.map((w) => (
                    <div
                      key={w}
                      className="flex items-center justify-center"
                      style={{
                        width: CELL,
                        height: 28,
                        fontSize: 12,
                        color: "var(--color-text-muted)",
                      }}
                    >
                      {w}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {grid.map((cell) => {
                    const state = {
                      selected: cell.key === selectedDate,
                      today: cell.key === today,
                      outside: cell.month !== view.month,
                      disabled: isDayDisabled(cell.key),
                    };
                    return (
                      <button
                        key={cell.key}
                        type="button"
                        disabled={state.disabled}
                        onClick={() => commitDay(cell.key)}
                        className={cn(
                          "mx-auto my-0.5 flex items-center justify-center transition-colors",
                          !state.selected &&
                            !state.disabled &&
                            "hover:bg-(--color-surface-sunken)",
                        )}
                        style={{
                          width: CELL - 6,
                          height: CELL - 6,
                          ...cellStyle(state),
                        }}
                      >
                        {cell.day}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {mode === "month" && (
              <div
                className="grid grid-cols-3 gap-1"
                style={{ width: CELL * 7, height: TIME_LIST_HEIGHT }}
              >
                {MONTHS_SHORT.map((m, i) => {
                  const isSel =
                    selectedDate.slice(0, 4) === String(view.year) &&
                    Number(selectedDate.slice(5, 7)) - 1 === i;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setView((v) => ({ ...v, month: i }));
                        setMode("date");
                      }}
                      className={cn(
                        "flex items-center justify-center rounded-md transition-colors",
                        !isSel && "hover:bg-(--color-surface-sunken)",
                      )}
                      style={{
                        fontSize: 13,
                        background: isSel
                          ? "var(--color-btn-bg)"
                          : "transparent",
                        color: isSel
                          ? "var(--color-btn-text)"
                          : "var(--color-text-dark)",
                        fontWeight: isSel ? 600 : 400,
                      }}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            )}

            {mode === "year" && (
              <div
                className="grid grid-cols-3 gap-1"
                style={{ width: CELL * 7, height: TIME_LIST_HEIGHT }}
              >
                {Array.from({ length: 12 }, (_, i) => decadeStart - 1 + i).map(
                  (y) => {
                    const outside = y < decadeStart || y > decadeStart + 9;
                    const isSel = selectedDate.slice(0, 4) === String(y);
                    return (
                      <button
                        key={y}
                        type="button"
                        onClick={() => {
                          setView((v) => ({ ...v, year: y }));
                          setMode("month");
                        }}
                        className={cn(
                          "flex items-center justify-center rounded-md transition-colors",
                          !isSel && "hover:bg-(--color-surface-sunken)",
                        )}
                        style={{
                          fontSize: 13,
                          background: isSel
                            ? "var(--color-btn-bg)"
                            : "transparent",
                          color: isSel
                            ? "var(--color-btn-text)"
                            : outside
                              ? "var(--color-text-muted)"
                              : "var(--color-text-dark)",
                          fontWeight: isSel ? 600 : 400,
                        }}
                      >
                        {y}
                      </button>
                    );
                  },
                )}
              </div>
            )}
          </div>

          {showTime && mode === "date" && (
            <div className="flex">
              {timeColumn(
                "Hr",
                Array.from({ length: 24 }, (_, i) => pad2(i)),
                selHour,
                (h) => commitTime(`${h}:${selMinute || "00"}`),
                hourListRef,
              )}
              {timeColumn(
                "Min",
                Array.from({ length: 60 }, (_, i) => pad2(i)),
                selMinute,
                (m) => commitTime(`${selHour || "00"}:${m}`),
                minuteListRef,
              )}
            </div>
          )}
        </div>

        {/* footer */}
        <div
          className="flex items-center px-3"
          style={{
            height: 38,
            borderTop: "1px solid var(--color-line)",
            justifyContent: showTime ? "space-between" : "center",
          }}
        >
          <button
            type="button"
            onClick={() => {
              const now = new Date();
              if (showTime) {
                commitDay(toYMD(now), { close: false });
                commitTime(`${pad2(now.getHours())}:${pad2(now.getMinutes())}`);
              } else {
                commitDay(toYMD(now));
              }
            }}
            disabled={isDayDisabled(today)}
            className="transition-opacity hover:opacity-70 disabled:opacity-40"
            style={{
              fontSize: 13,
              color: "var(--color-link)",
              cursor: isDayDisabled(today) ? "not-allowed" : "pointer",
            }}
          >
            {showTime ? "Now" : "Today"}
          </button>
          {showTime && (
            <button
              type="button"
              onClick={() => {
                if (!selectedDate) commitDay(today, { close: false });
                setOpen(false);
              }}
              className="rounded-md px-3 py-1 transition-opacity hover:opacity-90"
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                background: "var(--color-btn-bg)",
                color: "var(--color-btn-text)",
              }}
            >
              OK
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DatePicker;
