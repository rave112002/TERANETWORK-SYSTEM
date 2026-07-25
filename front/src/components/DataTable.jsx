import { useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import Spinner from "./Spinner";

/**
 * DataTable — the shared list-page table, built on @tanstack/react-table +
 * shadcn table primitives. Pagination stays external (<PaginationFooter />), so
 * there is no built-in pager.
 *
 * Accepts the project's column shape so page `hooks.jsx` column defs barely
 * change:
 *   columns: {
 *     title, key?, dataIndex?, render?(value, record, index),
 *     width?, align?, fixed?: "left" | "right", sorter?(a, b), ellipsis?
 *   }[]
 *
 * Props:
 *   dataSource   — row array
 *   rowKey       — field name or (record) => key   (default "id")
 *   rowSelection — { selectedRowKeys, onChange(keys) } adds a checkbox column
 *   loading      — bool → dims the body + shows a spinner overlay
 *   scroll       — { x } sets a min-width so the table scrolls horizontally
 *   emptyText    — shown when there are no rows
 */
const getRowKey = (record, rowKey, index) =>
  typeof rowKey === "function" ? rowKey(record) : (record?.[rowKey] ?? index);

const DataTable = ({
  columns = [],
  dataSource = [],
  rowKey = "id",
  rowSelection,
  loading = false,
  scroll,
  emptyText = "No data",
}) => {
  const tanstackColumns = useMemo(() => {
    const selectedKeys = rowSelection?.selectedRowKeys ?? [];
    const cols = [];

    if (rowSelection) {
      cols.push({
        id: "__select__",
        meta: { width: 48, align: "center" },
        header: () => {
          const keys = dataSource.map((r, i) => getRowKey(r, rowKey, i));
          const allChecked =
            keys.length > 0 && keys.every((k) => selectedKeys.includes(k));
          const someChecked = keys.some((k) => selectedKeys.includes(k));
          return (
            <Checkbox
              checked={
                allChecked ? true : someChecked ? "indeterminate" : false
              }
              onCheckedChange={(v) => rowSelection.onChange(v ? keys : [])}
              aria-label="Select all rows"
            />
          );
        },
        cell: ({ row }) => {
          const key = getRowKey(row.original, rowKey, row.index);
          const checked = selectedKeys.includes(key);
          return (
            <Checkbox
              checked={checked}
              onCheckedChange={(v) =>
                rowSelection.onChange(
                  v
                    ? [...selectedKeys, key]
                    : selectedKeys.filter((k) => k !== key),
                )
              }
              aria-label="Select row"
            />
          );
        },
      });
    }

    columns.forEach((c, i) => {
      const id = String(c.key ?? c.dataIndex ?? i);
      cols.push({
        id,
        header: c.title,
        enableSorting: !!c.sorter,
        sortingFn: c.sorter
          ? (a, b) => c.sorter(a.original, b.original)
          : undefined,
        cell: ({ row }) => {
          const value = c.dataIndex ? row.original[c.dataIndex] : undefined;
          return c.render
            ? c.render(value, row.original, row.index)
            : (value ?? null);
        },
        meta: {
          width: c.width,
          align: c.align,
          fixed: c.fixed,
          ellipsis: c.ellipsis,
        },
      });
    });

    return cols;
  }, [columns, dataSource, rowSelection, rowKey]);

  const table = useReactTable({
    data: dataSource,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row, index) => String(getRowKey(row, rowKey, index)),
  });

  const stickyStyle = (meta) =>
    meta?.fixed
      ? {
          position: "sticky",
          [meta.fixed]: 0,
          zIndex: 1,
          background: "var(--color-surface)",
        }
      : undefined;

  const rows = table.getRowModel().rows;

  return (
    <div className="relative w-full">
      {loading && (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{
            background:
              "color-mix(in srgb, var(--color-surface) 55%, transparent)",
          }}
        >
          <Spinner size="large" />
        </div>
      )}

      <Table style={scroll?.x ? { minWidth: scroll.x } : undefined}>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((header) => {
                const meta = header.column.columnDef.meta || {};
                const canSort = header.column.getCanSort();
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead
                    key={header.id}
                    onClick={
                      canSort
                        ? header.column.getToggleSortingHandler()
                        : undefined
                    }
                    className={cn(
                      "text-[11.5px] font-medium",
                      canSort && "cursor-pointer select-none",
                    )}
                    style={{
                      width: meta.width,
                      textAlign: meta.align,
                      color: "var(--color-text-muted)",
                      ...stickyStyle(meta),
                    }}
                  >
                    <span className="inline-flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {sorted === "asc" && <ChevronUp className="w-3 h-3" />}
                      {sorted === "desc" && <ChevronDown className="w-3 h-3" />}
                    </span>
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {rows.length === 0 && !loading ? (
            <TableRow>
              <TableCell
                colSpan={tanstackColumns.length}
                className="h-32 text-center"
                style={{ color: "var(--color-text-muted)" }}
              >
                {emptyText}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => {
                  const meta = cell.column.columnDef.meta || {};
                  return (
                    <TableCell
                      key={cell.id}
                      style={{
                        width: meta.width,
                        textAlign: meta.align,
                        ...(meta.ellipsis
                          ? {
                              maxWidth: meta.width,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }
                          : null),
                        ...stickyStyle(meta),
                      }}
                    >
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default DataTable;
