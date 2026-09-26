"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatDate, formatDeltaPercent, formatNumber, formatShortDate } from "@/lib/format";
import { pick } from "@/lib/i18n/core";

const AXIS = { fontSize: 11, fill: "var(--chart-axis)", fontFamily: "var(--font-sans)" };
export const SCENARIO_COLORS = ["var(--chart-scenario)", "var(--chart-series-2)", "var(--chart-series-4)", "var(--chart-series-3)"];

/** Baseline vs one or more scenarios over the horizon (daily units). */
export function ScenarioChart({ rows, scenarios, height = 280 }: { rows: Record<string, number | string>[]; scenarios: { key: string; label: string }[]; height?: number }) {
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(v: string) => formatShortDate(v)} tick={AXIS} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} minTickGap={28} />
          <YAxis tickFormatter={(v: number) => formatCompact(v)} tick={AXIS} tickLine={false} axisLine={false} width={48} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const base = payload.find((p) => p.dataKey === "baseline")?.value as number | undefined;
              return (
                <div className="min-w-52 rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-popover">
                  <div className="mb-1 font-semibold">{formatDate(label as string)}</div>
                  {payload.map((p) => {
                    const v = p.value as number;
                    const s = p.dataKey === "baseline" ? { label: pick("Acuan", "Baseline") } : scenarios.find((x) => x.key === p.dataKey);
                    return (
                      <div key={String(p.dataKey)} className="flex items-center justify-between gap-6">
                        <span className="inline-flex items-center gap-1.5 text-fg-secondary">
                          <span className="inline-block size-2 rounded-full" style={{ background: p.color }} aria-hidden />
                          {s?.label}
                        </span>
                        <span className="font-semibold tabular">
                          {formatNumber(v)}
                          {p.dataKey !== "baseline" && base ? <span className="ml-1 font-medium text-fg-tertiary">{formatDeltaPercent((v - base) / base)}</span> : null}
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            }}
          />
          <Line dataKey="baseline" stroke="var(--chart-forecast)" strokeWidth={2} dot={false} isAnimationActive={false} />
          {scenarios.map((s, i) => (
            <Line key={s.key} dataKey={s.key} stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} strokeWidth={2} strokeDasharray={i === 0 ? undefined : "5 3"} dot={false} isAnimationActive={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
