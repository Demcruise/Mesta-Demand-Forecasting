"use client";

import * as React from "react";
import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ForecastPoint } from "@/types/domain";
import { formatCompact, formatDate, formatDeltaPercent, formatNumber, formatShortDate } from "@/lib/format";
import { ChartDataTable, ChartFrame, LegendItem } from "./chart-frame";
import { pick } from "@/lib/i18n/core";

/**
 * ForecastChart (CHART-002). Answers: "What is expected to happen next, and how
 * different is it from historical behaviour?" Shows actuals, forecast, 80% interval,
 * the forecast start, and optionally the previous run.
 */

type Row = ForecastPoint & { band?: [number, number]; ts: number };

const AXIS = { fontSize: 11, fill: "var(--chart-axis)", fontFamily: "var(--font-sans)" };

function ForecastTooltip({ active, payload, unit }: { active?: boolean; payload?: { payload: Row }[]; unit: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  if (!p) return null;
  const delta =
    p.actual !== undefined && p.previousForecast !== undefined && p.previousForecast > 0
      ? { label: pick("Aktual vs perkiraan sebelumnya", "Actual vs previous forecast"), value: (p.actual - p.previousForecast) / p.previousForecast }
      : p.forecast !== undefined && p.previousForecast !== undefined && p.previousForecast > 0
        ? { label: pick("vs perkiraan sebelumnya", "vs previous run"), value: (p.forecast - p.previousForecast) / p.previousForecast }
        : null;
  const row = (label: string, value: number | undefined, color?: string) =>
    value === undefined ? null : (
      <div className="flex items-center justify-between gap-6">
        <span className="inline-flex items-center gap-1.5 text-fg-secondary">
          {color && <span className="inline-block size-2 rounded-full" style={{ background: color }} aria-hidden />}
          {label}
        </span>
        <span className="font-semibold tabular text-fg">{formatNumber(value)}</span>
      </div>
    );
  return (
    <div className="min-w-52 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-popover">
      <div className="mb-1.5 font-semibold text-fg">{formatDate(p.ts)}</div>
      <div className="flex flex-col gap-1">
        {row(pick("Aktual", "Actual"), p.actual, "var(--chart-actual)")}
        {row(pick("Perkiraan", "Forecast"), p.forecast, "var(--chart-forecast)")}
        {row(pick("Batas bawah", "Lower bound"), p.lowerBound)}
        {row(pick("Batas atas", "Upper bound"), p.upperBound)}
        {row(pick("Perkiraan sebelumnya", "Previous run"), p.previousForecast, "var(--chart-previous)")}
        {delta && (
          <div className="mt-1 flex items-center justify-between gap-6 border-t border-border-subtle pt-1">
            <span className="text-fg-secondary">{delta.label}</span>
            <span className="font-semibold tabular text-fg">{formatDeltaPercent(delta.value)}</span>
          </div>
        )}
      </div>
      <div className="mt-1 text-[0.6875rem] text-fg-tertiary">
        {pick("Satuan", "Unit")}: {unit}
      </div>
    </div>
  );
}

export function ForecastChartCanvas({
  points,
  height = 300,
  showPrevious = true,
  unit,
  todayLabel: todayLabelProp,
  showToday = true,
}: {
  points: ForecastPoint[];
  height?: number;
  showPrevious?: boolean;
  unit: string;
  todayLabel?: string;
  showToday?: boolean;
}) {
  const data = React.useMemo<Row[]>(
    () =>
      points.map((p) => ({
        ...p,
        ts: new Date(p.date).getTime(),
        band: p.lowerBound !== undefined && p.upperBound !== undefined ? [p.lowerBound, p.upperBound] : undefined,
      })),
    [points],
  );
  const firstForecast = data.find((d) => d.forecast !== undefined && d.actual === undefined);
  const hasPrevious = showPrevious && data.some((d) => d.previousForecast !== undefined);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis
            dataKey="ts"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            tickFormatter={(v: number) => formatShortDate(v)}
            tick={AXIS}
            tickLine={false}
            axisLine={{ stroke: "var(--chart-grid)" }}
            minTickGap={32}
          />
          <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={AXIS} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<ForecastTooltip unit={unit} />} cursor={{ stroke: "var(--border-strong)", strokeDasharray: "3 3" }} />
          <Area dataKey="band" stroke="none" fill="var(--chart-interval)" isAnimationActive={false} connectNulls={false} activeDot={false} />
          {hasPrevious && <Line dataKey="previousForecast" stroke="var(--chart-previous)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls={false} />}
          <Line dataKey="actual" stroke="var(--chart-actual)" strokeWidth={1.5} dot={false} isAnimationActive={false} connectNulls={false} />
          <Line dataKey="forecast" stroke="var(--chart-forecast)" strokeWidth={2} dot={false} isAnimationActive={false} connectNulls={false} />
          {showToday && firstForecast && (
            <ReferenceLine
              x={firstForecast.ts}
              stroke="var(--chart-today)"
              strokeDasharray="3 3"
              label={{ value: todayLabelProp ?? pick("Awal perkiraan", "Forecast start"), position: "insideTopLeft", fill: "var(--fg-secondary)", fontSize: 11, fontWeight: 600, offset: 6 }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ForecastLegend({ previous = true, previousLabel }: { previous?: boolean; previousLabel?: string }) {
  return (
    <>
      <LegendItem color="var(--chart-actual)" label={pick("Aktual", "Actual")} />
      <LegendItem color="var(--chart-forecast)" label={pick("Perkiraan", "Forecast")} />
      <LegendItem color="var(--chart-interval)" label={pick("Rentang perkiraan 80%", "80% prediction interval")} variant="area" />
      {previous && <LegendItem color="var(--chart-previous)" label={previousLabel ?? pick("Perkiraan sebelumnya", "Previous run")} variant="dashed" />}
    </>
  );
}

/** Full framed chart with legend, textual summary and data table alternative. */
export function ForecastChart({
  title,
  points,
  unit,
  source,
  asOf,
  summary,
  height,
  actions,
  question,
}: {
  title?: string;
  points: ForecastPoint[];
  unit: string;
  source?: string;
  asOf?: string | null;
  summary?: React.ReactNode;
  height?: number;
  actions?: React.ReactNode;
  question?: string;
}) {
  const chartTitle = title ?? pick("Aktual vs perkiraan", "Actual vs forecast");
  const first = points[0]?.date;
  const last = points[points.length - 1]?.date;
  const hasPrev = points.some((p) => p.previousForecast !== undefined);
  return (
    <ChartFrame
      title={chartTitle}
      question={question ?? pick("Apa yang akan terjadi, dan seberapa berbeda dari pola historis?", "What is expected to happen next, and how different is it from historical behaviour?")}
      unit={unit}
      timeframe={first && last ? pick(`${formatDate(first)} – ${formatDate(last)} · harian`, `${formatDate(first)} – ${formatDate(last)} · daily`) : ""}
      source={source}
      asOf={asOf}
      summary={summary}
      actions={actions}
      legend={<ForecastLegend previous={hasPrev} />}
      chart={<ForecastChartCanvas points={points} height={height} unit={unit} />}
      table={
        <ChartDataTable
          caption={pick(`${chartTitle} per hari`, `${chartTitle} by day`)}
          columns={[
            { key: "date", label: pick("Tanggal", "Date") },
            { key: "actual", label: pick("Aktual", "Actual"), numeric: true },
            { key: "forecast", label: pick("Perkiraan", "Forecast"), numeric: true },
            { key: "lower", label: pick("Batas bawah (80%)", "Lower (80%)"), numeric: true },
            { key: "upper", label: pick("Batas atas (80%)", "Upper (80%)"), numeric: true },
            { key: "prev", label: pick("Perkiraan sebelumnya", "Previous run"), numeric: true },
          ]}
          rows={[...points].reverse().map((p) => ({
            date: formatDate(p.date),
            actual: p.actual !== undefined ? formatNumber(p.actual) : null,
            forecast: p.forecast !== undefined ? formatNumber(p.forecast) : null,
            lower: p.lowerBound !== undefined ? formatNumber(p.lowerBound) : null,
            upper: p.upperBound !== undefined ? formatNumber(p.upperBound) : null,
            prev: p.previousForecast !== undefined ? formatNumber(p.previousForecast) : null,
          }))}
        />
      }
    />
  );
}
