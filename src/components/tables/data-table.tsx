"use client";

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type ColumnSizingState,
  type RowSelectionState,
  type VisibilityState,
} from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Columns3, Rows3 } from "lucide-react";
import * as React from "react";
import type { SortDirection } from "@/types/domain";
import { usePreferences, type Density } from "@/lib/preferences";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox, Segmented } from "@/components/ui/controls";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuTrigger, Tooltip } from "@/components/ui/overlay";
import { Select } from "@/components/ui/select";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";
import type { ExportFormat } from "@/lib/export";
import { ExportMenu } from "./export-menu";

/**
 * Enterprise DataTable (TABLE-001).
 *
 * - Header and body share ONE grid-template-columns string, so every cell in a column
 *   sits on the same track (Master Prompt §11.2). No per-row alignment hacks.
 * - Server-side sort/filter/pagination: the table renders the page it is given and
 *   reports sort/page changes; list state lives in the URL.
 * - Stable row geometry: fixed row height per density; long values truncate.
 * - Keyboard: rows are focusable; ↑/↓ move focus, Enter opens, Space toggles selection.
 */

export type ColumnMeta = {
  /** Right-align numeric columns (quantities, percentages, ratios). */
  numeric?: boolean;
  /** Grid track, e.g. "minmax(240px, 2fr)" or "120px". Defaults to minmax(120px, 1fr). */
  width?: string;
  /** Key used for server-side sorting; column is sortable when set. */
  sortKey?: string;
  /** Hidden below this breakpoint (responsive column priority). */
  hideBelow?: "sm" | "md" | "lg" | "xl";
  /** Label for the column-visibility menu when the header is not a string. */
  label?: string;
  /** Cannot be hidden. */
  pinned?: boolean;
  /** Header tooltip explaining the metric. */
  description?: string;
};

type DataTableProps<T> = {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  getRowId: (row: T) => string;
  /** Accessible table name. */
  label: string;
  isLoading?: boolean;
  isFetching?: boolean;
  error?: unknown;
  onRetry?: () => void;
  errorWhat?: string;
  empty: React.ReactNode;
  sort?: { key?: string; dir?: SortDirection; onChange: (key: string, dir: SortDirection) => void };
  pagination?: { page: number; pageSize: number; total: number; onPageChange: (p: number) => void; onPageSizeChange?: (s: number) => void };
  selection?: { selected: RowSelectionState; onChange: (s: RowSelectionState) => void; isSelectable?: (row: T) => boolean };
  onRowClick?: (row: T) => void;
  /** Currently opened row (e.g. in a drawer). */
  activeRowId?: string | null;
  onExport?: (format: ExportFormat) => void;
  exportLabel?: string;
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;
  /** Shown above the header while rows are selected (bulk actions). */
  bulkBar?: React.ReactNode;
  initialHidden?: string[];
  storageKey?: string;
  density?: Density;
  hideDensityToggle?: boolean;
  className?: string;
  footerNote?: React.ReactNode;
  maxHeight?: string;
};

function useBreakpointHidden(columns: ColumnDef<unknown, unknown>[]) {
  const [width, setWidth] = React.useState(1440);
  React.useEffect(() => {
    const on = () => setWidth(window.innerWidth);
    on();
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  const bp = { sm: 640, md: 768, lg: 1024, xl: 1280 };
  return React.useMemo(() => {
    const hidden: Record<string, boolean> = {};
    for (const c of columns) {
      const meta = c.meta as ColumnMeta | undefined;
      const id = (c.id ?? (c as { accessorKey?: string }).accessorKey) as string;
      if (meta?.hideBelow && width < bp[meta.hideBelow]) hidden[id] = true;
    }
    return hidden;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns, width]);
}

export function DataTable<T>({
  columns,
  data,
  getRowId,
  label,
  isLoading,
  isFetching,
  error,
  onRetry,
  errorWhat = "The table could not be loaded.",
  empty,
  sort,
  pagination,
  selection,
  onRowClick,
  activeRowId,
  onExport,
  exportLabel = "Export",
  toolbarStart,
  toolbarEnd,
  bulkBar,
  initialHidden = [],
  storageKey,
  density: densityProp,
  hideDensityToggle,
  className,
  footerNote,
  maxHeight,
}: DataTableProps<T>) {
  const prefs = usePreferences();
  const [localDensity, setLocalDensity] = React.useState<Density | null>(null);
  const density = densityProp ?? localDensity ?? prefs.density;
  const [visibility, setVisibility] = React.useState<VisibilityState>(() => {
    const v: VisibilityState = Object.fromEntries(initialHidden.map((id) => [id, false]));
    if (storageKey && typeof window !== "undefined") {
      try {
        Object.assign(v, JSON.parse(window.localStorage.getItem(`mdf.cols.${storageKey}`) ?? "{}"));
      } catch {
        // ignore
      }
    }
    return v;
  });
  const [sizing, setSizing] = React.useState<ColumnSizingState>({});
  const bpHidden = useBreakpointHidden(columns as ColumnDef<unknown, unknown>[]);

  React.useEffect(() => {
    if (!storageKey) return;
    try {
      window.localStorage.setItem(`mdf.cols.${storageKey}`, JSON.stringify(visibility));
    } catch {
      // ignore
    }
  }, [visibility, storageKey]);

  const selectionColumn: ColumnDef<T, unknown> | null = selection
    ? {
        id: "__select",
        meta: { width: "44px", pinned: true, label: "Select" } satisfies ColumnMeta,
        header: ({ table }) => {
          const rows = table.getRowModel().rows.filter((r) => r.getCanSelect());
          const all = rows.length > 0 && rows.every((r) => r.getIsSelected());
          const some = rows.some((r) => r.getIsSelected());
          return (
            <Checkbox
              aria-label={all ? "Deselect all rows on this page" : "Select all rows on this page"}
              checked={all ? true : some ? "indeterminate" : false}
              disabled={rows.length === 0}
              onCheckedChange={(v) => rows.forEach((r) => r.toggleSelected(v === true))}
            />
          );
        },
        cell: ({ row }) => (
          <Checkbox
            aria-label="Select row"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onClick={(e) => e.stopPropagation()}
            onCheckedChange={(v) => row.toggleSelected(v === true)}
          />
        ),
      }
    : null;

  const allColumns = React.useMemo(() => (selectionColumn ? [selectionColumn, ...columns] : columns), [selectionColumn, columns]);

  const table = useReactTable({
    data: data ?? [],
    columns: allColumns,
    getRowId: (row) => getRowId(row),
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    manualPagination: true,
    enableRowSelection: selection ? (row) => (selection.isSelectable ? selection.isSelectable(row.original) : true) : false,
    state: { columnVisibility: { ...visibility, ...bpHidden }, rowSelection: selection?.selected ?? {}, columnSizing: sizing },
    onColumnVisibilityChange: setVisibility,
    onColumnSizingChange: setSizing,
    columnResizeMode: "onChange",
    onRowSelectionChange: (updater) => {
      if (!selection) return;
      selection.onChange(typeof updater === "function" ? updater(selection.selected) : updater);
    },
  });

  const visibleColumns = table.getVisibleLeafColumns();
  const template = visibleColumns
    .map((c) => {
      const size = sizing[c.id];
      if (size) return `${size}px`;
      return (c.columnDef.meta as ColumnMeta | undefined)?.width ?? "minmax(120px, 1fr)";
    })
    .join(" ");
  const rowHeight = density === "compact" ? "var(--row-h-compact)" : "var(--row-h-comfortable)";
  const rows = table.getRowModel().rows;
  const bodyRef = React.useRef<HTMLDivElement>(null);

  const onRowKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, index: number, row: (typeof rows)[number]) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = bodyRef.current?.querySelectorAll<HTMLElement>("[data-row]")[index + (e.key === "ArrowDown" ? 1 : -1)];
      next?.focus();
    } else if (e.key === "Enter" && onRowClick) {
      e.preventDefault();
      onRowClick(row.original);
    } else if (e.key === " " && selection && row.getCanSelect()) {
      e.preventDefault();
      row.toggleSelected();
    }
  };

  const hideable = table.getAllLeafColumns().filter((c) => !(c.columnDef.meta as ColumnMeta | undefined)?.pinned && c.id !== "__select");
  const selectedCount = Object.keys(selection?.selected ?? {}).filter((k) => selection?.selected[k]).length;
  const pageCount = pagination ? Math.max(1, Math.ceil(pagination.total / pagination.pageSize)) : 1;

  return (
    <div className={cn("flex min-w-0 flex-col rounded-lg border border-border bg-surface shadow-sm", className)}>
      {(toolbarStart || toolbarEnd || onExport || !hideDensityToggle) && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2.5">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{toolbarStart}</div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {toolbarEnd}
            {!hideDensityToggle && (
              <Segmented
                size="sm"
                aria-label="Row density"
                value={density}
                onValueChange={(v) => setLocalDensity(v)}
                options={[
                  { value: "comfortable", label: <span className="sr-only sm:not-sr-only">Comfortable</span>, icon: <Rows3 aria-hidden /> },
                  { value: "compact", label: <span className="sr-only sm:not-sr-only">Compact</span>, icon: <Rows3 className="scale-y-75" aria-hidden /> },
                ]}
              />
            )}
            {hideable.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="secondary" aria-label="Choose columns">
                    <Columns3 aria-hidden />
                    <span className="hidden sm:inline">Columns</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56">
                  <DropdownMenuLabel>Visible columns</DropdownMenuLabel>
                  {hideable.map((c) => {
                    const meta = c.columnDef.meta as ColumnMeta | undefined;
                    const text = meta?.label ?? (typeof c.columnDef.header === "string" ? c.columnDef.header : c.id);
                    return (
                      <DropdownMenuCheckboxItem key={c.id} checked={visibility[c.id] !== false} onCheckedChange={(v) => setVisibility((prev) => ({ ...prev, [c.id]: v === true }))} onSelect={(e) => e.preventDefault()}>
                        {text}
                        {meta?.hideBelow && bpHidden[c.id] && <span className="ml-auto text-[0.6875rem] text-fg-tertiary">Hidden at this width</span>}
                      </DropdownMenuCheckboxItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {onExport && <ExportMenu label={exportLabel} onExport={onExport} />}
          </div>
        </div>
      )}
      {bulkBar && selectedCount > 0 && <div className="border-b border-border bg-selected px-3 py-2">{bulkBar}</div>}

      {error ? (
        <ErrorState what={errorWhat} error={error} onRetry={onRetry} retryLabel="Retry loading" />
      ) : isLoading ? (
        <TableSkeleton rows={Math.min(pagination?.pageSize ?? 10, 10)} columns={Math.min(visibleColumns.length, 7)} density={density} />
      ) : (
        <div className="relative overflow-x-auto" style={maxHeight ? { maxHeight } : undefined}>
          <div role="table" aria-label={label} aria-rowcount={pagination?.total ?? rows.length} aria-busy={isFetching || undefined} className="min-w-full" style={{ minWidth: "max-content" }}>
            <div role="rowgroup" className="sticky top-0 z-[1]">
              {table.getHeaderGroups().map((hg) => (
                <div key={hg.id} role="row" className="grid h-10 items-stretch border-b border-border bg-subtle" style={{ gridTemplateColumns: template }}>
                  {hg.headers.map((header) => {
                    const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                    const sortable = !!meta?.sortKey && !!sort;
                    const activeSort = sortable && sort?.key === meta?.sortKey;
                    const ariaSort = activeSort ? (sort?.dir === "asc" ? "ascending" : "descending") : sortable ? "none" : undefined;
                    const content = header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext());
                    return (
                      <div
                        key={header.id}
                        role="columnheader"
                        aria-sort={ariaSort}
                        className={cn(
                          "relative flex min-w-0 items-center px-3 text-xs font-semibold text-fg-secondary",
                          meta?.numeric && "justify-end text-right",
                          header.column.id === "__select" && "justify-center px-0",
                        )}
                      >
                        {sortable ? (
                          <button
                            type="button"
                            className={cn("inline-flex min-w-0 items-center gap-1 rounded-xs hover:text-fg focus-visible:outline-2 focus-visible:outline-focus", meta?.numeric && "flex-row-reverse", activeSort && "text-fg")}
                            onClick={() => sort?.onChange(meta!.sortKey!, activeSort && sort?.dir === "desc" ? "asc" : "desc")}
                            title={meta?.description}
                          >
                            <span className="truncate">{content}</span>
                            {activeSort ? sort?.dir === "asc" ? <ArrowUp className="size-3.5 shrink-0" aria-hidden /> : <ArrowDown className="size-3.5 shrink-0" aria-hidden /> : <ArrowUpDown className="size-3.5 shrink-0 opacity-40" aria-hidden />}
                          </button>
                        ) : meta?.description ? (
                          <Tooltip content={meta.description}>
                            <span tabIndex={0} className="truncate underline decoration-border-strong decoration-dotted underline-offset-4">
                              {content}
                            </span>
                          </Tooltip>
                        ) : (
                          <span className="truncate">{content}</span>
                        )}
                        {header.column.getCanResize() && header.column.id !== "__select" && (
                          <div
                            onMouseDown={header.getResizeHandler()}
                            onTouchStart={header.getResizeHandler()}
                            onDoubleClick={() => header.column.resetSize()}
                            className="absolute right-0 top-2 h-6 w-1.5 cursor-col-resize rounded-full opacity-0 hover:bg-border-strong hover:opacity-100"
                            aria-hidden
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div role="rowgroup" ref={bodyRef} className={cn(isFetching && "opacity-70 transition-opacity")}>
              {rows.length === 0 ? (
                <div role="row">
                  <div role="cell">{empty}</div>
                </div>
              ) : (
                rows.map((row, index) => {
                  const active = activeRowId === row.id;
                  return (
                    <div
                      key={row.id}
                      role="row"
                      data-row
                      tabIndex={onRowClick ? 0 : -1}
                      aria-selected={selection ? row.getIsSelected() : undefined}
                      aria-current={active || undefined}
                      onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                      onKeyDown={(e) => onRowKeyDown(e, index, row)}
                      className={cn(
                        "grid items-center border-b border-border-subtle last:border-b-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus",
                        onRowClick && "cursor-pointer hover:bg-hover",
                        (row.getIsSelected() || active) && "bg-selected hover:bg-selected",
                      )}
                      style={{ gridTemplateColumns: template, height: rowHeight }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                        return (
                          <div
                            key={cell.id}
                            role="cell"
                            className={cn(
                              "flex h-full min-w-0 items-center overflow-hidden px-3 text-[0.8125rem] text-fg",
                              meta?.numeric && "justify-end text-right tabular",
                                  cell.column.id === "__select" && "justify-center px-0",
                            )}
                          >
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {pagination && !error && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3 py-2">
          <p className="caption tabular" aria-live="polite">
            {pagination.total === 0
              ? "0 rows"
              : `${formatNumber((pagination.page - 1) * pagination.pageSize + 1)}–${formatNumber(Math.min(pagination.total, pagination.page * pagination.pageSize))} of ${formatNumber(pagination.total)}`}
            {selectedCount > 0 && ` · ${formatNumber(selectedCount)} selected`}
            {footerNote && <span className="ml-2">{footerNote}</span>}
          </p>
          <div className="flex items-center gap-2">
            {pagination.onPageSizeChange && (
              <div className="hidden items-center gap-2 sm:flex">
                <span className="caption">Rows</span>
                <Select
                  size="sm"
                  aria-label="Rows per page"
                  className="w-20"
                  value={String(pagination.pageSize)}
                  onValueChange={(v) => pagination.onPageSizeChange?.(Number(v))}
                  options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
                />
              </div>
            )}
            <nav aria-label="Pagination" className="flex items-center gap-1">
              <Button size="icon-sm" variant="ghost" aria-label="First page" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(1)}>
                <ChevronsLeft aria-hidden />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)}>
                <ChevronLeft aria-hidden />
              </Button>
              <span className="min-w-20 text-center caption tabular">
                Page {formatNumber(pagination.page)} of {formatNumber(pageCount)}
              </span>
              <Button size="icon-sm" variant="ghost" aria-label="Next page" disabled={pagination.page >= pageCount} onClick={() => pagination.onPageChange(pagination.page + 1)}>
                <ChevronRight aria-hidden />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Last page" disabled={pagination.page >= pageCount} onClick={() => pagination.onPageChange(pageCount)}>
                <ChevronsRight aria-hidden />
              </Button>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}

