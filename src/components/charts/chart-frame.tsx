"use client";

import { BarChart3, Table2 } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Segmented } from "@/components/ui/controls";
import { FreshnessIndicator } from "@/components/feedback/freshness";

/**
 * ChartFrame (CHART-001): every quantitative chart states the question it answers,
 * its unit and timeframe, its source/freshness, and offers the same data as a table.
 */
export function ChartFrame({
  title,
  question,
  unit,
  timeframe,
  source,
  asOf,
  legend,
  summary,
  chart,
  table,
  actions,
  className,
  defaultView = "chart",
}: {
  title: string;
  /** The question the chart answers, shown as the description. */
  question?: string;
  unit: string;
  timeframe: string;
  source?: string;
  asOf?: string | null;
  legend?: React.ReactNode;
  /** Plain-language summary: the textual equivalent of the chart. */
  summary?: React.ReactNode;
  chart: React.ReactNode;
  table: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  defaultView?: "chart" | "table";
}) {
  const [view, setView] = React.useState<"chart" | "table">(defaultView);
  const id = React.useId();
  return (
    <section className={cn("flex min-w-0 flex-col rounded-lg border border-border bg-surface shadow-sm", className)} aria-labelledby={`${id}-t`}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-subtle px-4 py-3">
        <div className="min-w-0">
          <h3 id={`${id}-t`} className="card-title">
            {title}
          </h3>
          {question && <p className="mt-0.5 caption">{question}</p>}
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-tertiary">
            <span>Unit: {unit}</span>
            <span>{timeframe}</span>
            {source && <span>Source: {source}</span>}
            {asOf !== undefined && <FreshnessIndicator timestamp={asOf} label="Data as of" source={source} />}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          <Segmented
            size="sm"
            aria-label="View as"
            value={view}
            onValueChange={setView}
            options={[
              { value: "chart", label: <span className="sr-only">Chart</span>, icon: <BarChart3 aria-hidden /> },
              { value: "table", label: <span className="sr-only">Table</span>, icon: <Table2 aria-hidden /> },
            ]}
          />
        </div>
      </div>
      {summary && <div className="border-b border-border-subtle bg-subtle px-4 py-2.5 body-sm text-fg-secondary">{summary}</div>}
      <div className="min-w-0 flex-1 p-4">
        {view === "chart" ? (
          <>
            {legend && <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1.5">{legend}</div>}
            <div role="img" aria-label={`${title}. ${typeof summary === "string" ? summary : "Switch to table view for exact values."}`}>
              {chart}
            </div>
          </>
        ) : (
          table
        )}
      </div>
    </section>
  );
}

export function LegendItem({ color, label, variant = "line" }: { color: string; label: React.ReactNode; variant?: "line" | "dashed" | "area" | "bar" | "dot" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-fg-secondary">
      {variant === "area" ? (
        <span className="inline-block h-2.5 w-4 rounded-xs" style={{ background: color, border: "1px solid color-mix(in srgb, var(--chart-forecast) 40%, transparent)" }} aria-hidden />
      ) : variant === "bar" ? (
        <span className="inline-block size-2.5 rounded-xs" style={{ background: color }} aria-hidden />
      ) : variant === "dot" ? (
        <span className="inline-block size-2 rounded-full" style={{ background: color }} aria-hidden />
      ) : (
        <span className="inline-block w-4" style={{ borderTop: `2px ${variant === "dashed" ? "dashed" : "solid"} ${color}` }} aria-hidden />
      )}
      {label}
    </span>
  );
}

/** Compact data table used as the chart alternative. */
export function ChartDataTable({ columns, rows, caption, maxHeight = "20rem" }: { columns: { key: string; label: string; numeric?: boolean }[]; rows: Record<string, React.ReactNode>[]; caption: string; maxHeight?: string }) {
  return (
    <div className="overflow-auto rounded-md border border-border" style={{ maxHeight }}>
      <table className="w-full border-collapse text-[0.8125rem]">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-subtle">
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" className={cn("whitespace-nowrap border-b border-border px-3 py-2 text-xs font-semibold text-fg-secondary", c.numeric ? "text-right" : "text-left")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-border-subtle last:border-b-0">
              {columns.map((c, j) =>
                j === 0 ? (
                  <th key={c.key} scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-medium text-fg">
                    {r[c.key]}
                  </th>
                ) : (
                  <td key={c.key} className={cn("whitespace-nowrap px-3 py-1.5 text-fg", c.numeric && "text-right tabular")}>
                    {r[c.key] ?? "—"}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
