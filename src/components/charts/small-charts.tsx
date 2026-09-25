"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatNumber, formatPercent, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const AXIS = { fontSize: 11, fill: "var(--chart-axis)", fontFamily: "var(--font-sans)" };

/**
 * Sparkline: weekly trend inside table rows. The last `forecastFrom` points are the
 * forecast (drawn in the forecast colour). Decorative only; the row carries the values.
 */
export function Sparkline({ values, forecastFrom, width = 88, height = 24, label }: { values: number[]; forecastFrom?: number; width?: number; height?: number; label?: string }) {
  if (values.length < 2) return <span className="text-fg-tertiary">—</span>;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => (i / (values.length - 1)) * (width - 2) + 1;
  const y = (v: number) => height - 2 - ((v - min) / (max - min || 1)) * (height - 4);
  const split = forecastFrom ?? values.length;
  const path = (from: number, to: number) =>
    values
      .slice(from, to)
      .map((v, i) => `${i === 0 ? "M" : "L"}${x(i + from).toFixed(1)},${y(v).toFixed(1)}`)
      .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true} className="shrink-0 overflow-visible">
      <path d={path(0, split)} fill="none" stroke="var(--chart-actual)" strokeWidth={1.25} strokeLinejoin="round" />
      {split < values.length && <path d={path(split - 1, values.length)} fill="none" stroke="var(--chart-forecast)" strokeWidth={1.5} strokeLinejoin="round" />}
    </svg>
  );
}

/** Horizontal paired bars: e.g. forecast vs previous, or baseline vs scenario, per category. */
export function PairedBars({
  rows,
  aLabel,
  bLabel,
  aColor = "var(--chart-previous)",
  bColor = "var(--chart-forecast)",
  height,
}: {
  rows: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  aColor?: string;
  bColor?: string;
  height?: number;
}) {
  const h = height ?? Math.max(180, rows.length * 44 + 40);
  return (
    <div style={{ height: h }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 0 }} barGap={2} barCategoryGap="28%">
          <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
          <XAxis type="number" tickFormatter={(v: number) => formatCompact(v)} tick={AXIS} tickLine={false} axisLine={false} />
          <YAxis type="category" dataKey="label" tick={{ ...AXIS, fill: "var(--fg-secondary)" }} tickLine={false} axisLine={false} width={116} />
          <Tooltip
            cursor={{ fill: "var(--bg-hover)" }}
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                  <div className="mb-1 font-semibold">{label}</div>
                  {payload.map((p) => (
                    <div key={String(p.dataKey)} className="flex justify-between gap-6">
                      <span className="text-fg-secondary">{p.dataKey === "a" ? aLabel : bLabel}</span>
                      <span className="font-semibold tabular">{formatNumber(p.value as number)}</span>
                    </div>
                  ))}
                  {payload.length === 2 && (payload[0]?.value as number) > 0 && (
                    <div className="mt-1 flex justify-between gap-6 border-t border-border-subtle pt-1">
                      <span className="text-fg-secondary">Change</span>
                      <span className="font-semibold tabular">{formatPercent(((payload[1]?.value as number) - (payload[0]?.value as number)) / (payload[0]?.value as number))}</span>
                    </div>
                  )}
                </div>
              ) : null
            }
          />
          <Bar dataKey="a" fill={aColor} radius={[0, 2, 2, 0]} isAnimationActive={false} maxBarSize={14} />
          <Bar dataKey="b" fill={bColor} radius={[0, 2, 2, 0]} isAnimationActive={false} maxBarSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical histogram (e.g. forecast error distribution). */
export function Histogram({ rows, label, height = 220, highlight }: { rows: { bucket: string; count: number }[]; label: string; height?: number; highlight?: (bucket: string) => boolean }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="bucket" tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} />
          <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} tickFormatter={(v: number) => formatCompact(v)} />
          <Tooltip
            cursor={{ fill: "var(--bg-hover)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                  <div className="font-semibold">{payload[0]?.payload.bucket}</div>
                  <div className="tabular">
                    {formatNumber(payload[0]?.value as number)} {label}
                  </div>
                </div>
              ) : null
            }
          />
          <Bar dataKey="count" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {rows.map((r) => (
              <Cell key={r.bucket} fill={highlight?.(r.bucket) ? "var(--warning)" : "var(--chart-series-1)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Multi-series metric trend (e.g. weekly WAPE per model). */
export function MetricTrend({
  rows,
  series,
  xKey,
  height = 240,
  format = (v: number) => formatPercent(v),
  referenceY,
}: {
  rows: Record<string, number | string>[];
  series: { key: string; label: string; color: string }[];
  xKey: string;
  height?: number;
  format?: (v: number) => string;
  referenceY?: number;
}) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey={xKey} tickFormatter={(v: string) => formatShortDate(v)} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} minTickGap={24} />
          <YAxis tickFormatter={(v: number) => format(v)} tick={AXIS} tickLine={false} axisLine={false} width={52} domain={referenceY !== undefined ? ["auto", "auto"] : undefined} />
          <Tooltip
            content={({ active, payload, label }) =>
              active && payload?.length ? (
                <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
                  <div className="mb-1 font-semibold">Week of {formatShortDate(label as string)}</div>
                  {payload.map((p) => {
                    const s = series.find((x) => x.key === p.dataKey);
                    return (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-6">
                        <span className="inline-flex items-center gap-1.5 text-fg-secondary">
                          <span className="inline-block size-2 rounded-full" style={{ background: s?.color }} aria-hidden />
                          {s?.label}
                        </span>
                        <span className="font-semibold tabular">{format(p.value as number)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : null
            }
          />
          <Legend content={() => null} />
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} stroke={s.color} strokeWidth={2} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Inline proportion bar for tables (e.g. volume share). Always paired with the number. */
export function ShareBar({ value, className }: { value: number; className?: string }) {
  return (
    <span className={cn("inline-flex h-1.5 w-16 overflow-hidden rounded-full bg-muted", className)} aria-hidden>
      <span className="h-full rounded-full bg-[var(--chart-series-1)]" style={{ width: `${Math.max(2, Math.min(100, value * 100))}%` }} />
    </span>
  );
}
