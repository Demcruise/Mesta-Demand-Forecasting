import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { formatDeltaNumber, formatDeltaPercent, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlay";
import { pick } from "@/lib/i18n/core";

/**
 * Colour for a signed value. Sign is the only thing that decides it: increases are
 * green, decreases red, and an exact zero stays neutral because it is neither.
 */
export function deltaToneClass(percent: number | null | undefined) {
  if (percent == null || Number.isNaN(percent) || Math.abs(percent) < 0.0005) return "text-fg-tertiary";
  return percent > 0 ? "text-success-fg" : "text-critical-fg";
}

/** Signed percentage rendered as a value (no icon), coloured by sign. */
export function SignedPercent({ percent, className }: { percent: number | null | undefined; className?: string }) {
  return <span className={cn("tabular", deltaToneClass(percent), className)}>{formatDeltaPercent(percent ?? 0)}</span>;
}

/**
 * ForecastDelta: signed change with icon + sign + text. Increases are green and
 * decreases red; the review threshold is noted for assistive tech rather than
 * signalled with a third colour.
 */
export function ForecastDelta({
  percent,
  units,
  threshold = 0.15,
  size = "md",
  className,
  showUnits,
}: {
  percent: number | null | undefined;
  units?: number | null;
  threshold?: number;
  size?: "sm" | "md";
  className?: string;
  showUnits?: boolean;
}) {
  if (percent == null || Number.isNaN(percent)) return <span className="text-fg-tertiary">—</span>;
  const abs = Math.abs(percent);
  const flat = abs < 0.0005;
  const Icon = flat ? ArrowRight : percent > 0 ? ArrowUpRight : ArrowDownRight;
  const emphasised = abs >= threshold;
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-0.5 whitespace-nowrap font-semibold tabular",
        size === "sm" ? "text-xs" : "text-sm",
        deltaToneClass(percent),
        className,
      )}
      title={emphasised ? pick("Di atas batas tinjauan 15%", "Above the 15% review threshold") : undefined}
      aria-label={pick(`${flat ? "Tanpa perubahan" : percent > 0 ? "Naik" : "Turun"} ${formatDeltaPercent(percent)}${emphasised ? ", di atas batas tinjauan" : ""}`, `${flat ? "No change" : percent > 0 ? "Up" : "Down"} ${formatDeltaPercent(percent)}${emphasised ? ", above the review threshold" : ""}`)}
    >
      <Icon className={size === "sm" ? "size-3.5" : "size-4"} aria-hidden />
      {formatDeltaPercent(percent)}
      {showUnits && units != null && <span className="ml-1 font-medium text-fg-tertiary">({formatDeltaNumber(units)})</span>}
    </span>
  );
}

/**
 * MetricCard: label → value → context line. Every KPI shows unit, period and a
 * comparison baseline, and links to the surface where the user can act on it.
 */
export function MetricCard({
  label,
  value,
  unit,
  context,
  delta,
  footnote,
  href,
  hrefLabel,
  tooltip,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  context?: React.ReactNode;
  delta?: React.ReactNode;
  footnote?: React.ReactNode;
  href?: string;
  hrefLabel?: string;
  tooltip?: React.ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        {tooltip ? (
          <Tooltip content={tooltip}>
            <span tabIndex={0} className="caption font-semibold underline decoration-border-strong decoration-dotted underline-offset-4">
              {label}
            </span>
          </Tooltip>
        ) : (
          <span className="caption font-semibold">{label}</span>
        )}
        {delta}
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="numeric-lg text-fg">{value}</span>
        {unit && <span className="body-sm text-fg-tertiary">{unit}</span>}
      </div>
      {context && <div className="mt-1 caption">{context}</div>}
      {footnote && <div className="mt-auto pt-3 caption">{footnote}</div>}
      {href && hrefLabel && <span className="mt-auto pt-3 text-xs font-semibold text-primary group-hover:underline">{hrefLabel} →</span>}
    </>
  );
  const cls = cn("group flex h-full min-w-0 flex-col rounded-lg border border-border bg-surface p-4", className);
  if (href) {
    return (
      <Link href={href} className={cn(cls, "transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus")}>
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

export function MetricStrip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>{children}</div>;
}

/**
 * ForecastInterval (UNCERTAINTY-001): effective-bound visualisation.
 *   Lower bound ───────────── Upper bound
 *                 │
 *              Forecast
 * Every marker is labelled; the scale includes the comparison value when given.
 */
export function ForecastInterval({
  lower,
  upper,
  forecast,
  comparison,
  comparisonLabel = "Previous run",
  unit = "units",
  coverage = 0.8,
  override,
  className,
}: {
  lower: number;
  upper: number;
  forecast: number;
  comparison?: number | null;
  comparisonLabel?: string;
  unit?: string;
  coverage?: number;
  override?: number | null;
  className?: string;
}) {
  const values = [lower, upper, forecast, comparison ?? forecast, override ?? forecast];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || Math.max(1, forecast * 0.1);
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-label={`Forecast ${formatNumber(forecast)} ${unit}; ${Math.round(coverage * 100)}% prediction interval ${formatNumber(lower)} to ${formatNumber(upper)} ${unit}${comparison != null ? `; ${comparisonLabel.toLowerCase()} ${formatNumber(comparison)} ${unit}` : ""}`}>
      <div className="relative mx-6 h-[4.5rem]" aria-hidden>
        {/* axis */}
        <div className="absolute inset-x-0 top-7 h-px bg-border" />
        {/* interval band */}
        <div className="absolute top-5 h-4 rounded-xs border bg-[var(--chart-interval)]" style={{ left: pos(lower), width: `calc(${pos(upper)} - ${pos(lower)})`, borderColor: "color-mix(in srgb, var(--chart-forecast) 45%, transparent)" }} />
        {/* bounds */}
        <Marker at={pos(lower)} label="Lower" value={formatNumber(lower)} align="below" tone="muted" />
        <Marker at={pos(upper)} label="Upper" value={formatNumber(upper)} align="below" tone="muted" />
        {/* forecast */}
        <Marker at={pos(forecast)} label="Forecast" value={formatNumber(forecast)} align="above" tone="forecast" />
        {comparison != null && <Marker at={pos(comparison)} label={comparisonLabel} value="" align="tick" tone="previous" />}
        {override != null && <Marker at={pos(override)} label="Override" value="" align="tick" tone="override" />}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 caption">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-xs border" style={{ background: "var(--chart-interval)", borderColor: "color-mix(in srgb, var(--chart-forecast) 45%, transparent)" }} />
          {Math.round(coverage * 100)}% prediction interval
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5" style={{ background: "var(--chart-forecast)" }} />
          Forecast
        </span>
        {comparison != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 border-l border-dashed" style={{ borderColor: "var(--chart-previous)" }} />
            {comparisonLabel}: {formatNumber(comparison)}
          </span>
        )}
        {override != null && (
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5" style={{ background: "var(--chart-scenario)" }} />
            Override: {formatNumber(override)}
          </span>
        )}
      </figcaption>
    </figure>
  );
}

function Marker({ at, label, value, align, tone }: { at: string; label: string; value: string; align: "above" | "below" | "tick"; tone: "forecast" | "muted" | "previous" | "override" }) {
  const color = tone === "forecast" ? "var(--chart-forecast)" : tone === "previous" ? "var(--chart-previous)" : tone === "override" ? "var(--chart-scenario)" : "var(--fg-tertiary)";
  return (
    <div className="absolute top-0 h-full -translate-x-1/2" style={{ left: at }}>
      <div className="absolute left-1/2 top-3.5 h-7 -translate-x-1/2" style={{ width: tone === "forecast" ? 2 : 1, background: tone === "previous" ? "transparent" : color, borderLeft: tone === "previous" ? `1px dashed ${color}` : undefined }} />
      {align === "above" && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.6875rem] font-bold tabular" style={{ color }}>
          {value}
        </div>
      )}
      {align === "below" && (
        <div className="absolute top-11 left-1/2 flex -translate-x-1/2 flex-col items-center whitespace-nowrap text-[0.6875rem] leading-3 tabular text-fg-secondary">
          <span className="font-semibold">{value}</span>
          <span className="text-fg-tertiary">{label}</span>
        </div>
      )}
    </div>
  );
}
