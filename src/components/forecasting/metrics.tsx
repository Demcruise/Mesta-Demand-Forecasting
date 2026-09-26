"use client";

import { ArrowDownRight, ArrowRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { formatDeltaCompact, formatDeltaNumber, formatDeltaPercent, formatDeltaPoints, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlay";
import { Sparkline } from "@/components/charts/small-charts";
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
 * MetricDelta: short signed comparison for compact metric cards (FE-METRIC-004).
 * Arrow + sign + value, coloured by sign only — a change is not judged good or bad.
 */
export function MetricDelta({ value, kind = "percent", className }: { value: number | null | undefined; kind?: "percent" | "points" | "compact" | "number"; className?: string }) {
  if (value == null || Number.isNaN(value)) return null;
  const flat = kind === "percent" || kind === "points" ? Math.abs(value) < 0.0005 : Math.round(value) === 0;
  const Icon = flat ? ArrowRight : value > 0 ? ArrowUpRight : ArrowDownRight;
  const text = kind === "percent" ? formatDeltaPercent(value) : kind === "points" ? formatDeltaPoints(value) : kind === "compact" ? formatDeltaCompact(value) : formatDeltaNumber(value);
  const tone = flat ? "text-fg-tertiary" : value > 0 ? "text-success-fg" : "text-critical-fg";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap text-xs font-semibold tabular", tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      <span className="sr-only">{flat ? pick("Tidak berubah", "Unchanged") : value > 0 ? pick("Naik", "Up") : pick("Turun", "Down")} </span>
      {text}
    </span>
  );
}

type MetricCardProps = {
  label: string;
  value: React.ReactNode;
  unit?: string;
  delta?: React.ReactNode;
  href?: string;
  /** Header tooltip: definitions and calculation detail, never the primary meaning. */
  tooltip?: React.ReactNode;
  className?: string;
} & (
  | {
      /**
       * detailed (default): label → value → context → footnote → link. For detail
       * pages where the card is the only place the explanation lives.
       */
      variant?: "detailed";
      context?: React.ReactNode;
      footnote?: React.ReactNode;
      hrefLabel?: string;
      /** §99/§111: the value zone is centred here too, so every KPI strip matches. */
      valueAlign?: "left" | "center";
    }
  | {
      /**
       * compact (FE-METRIC-001): icon + label → one dominant value → one short
       * comparison row → optional real micro trend. Whole card is the link.
       */
      variant: "compact";
      icon?: LucideIcon;
      /** Exact value for tooltip and assistive tech when `value` is abbreviated. */
      exactValue?: string;
      /** Short comparison baseline shown after the delta, e.g. "vs previous run". */
      comparison?: React.ReactNode;
      /** One short supporting line when there is no delta (e.g. "29 critical · 58 warning"). */
      meta?: React.ReactNode;
      /** Micro trend from real history only (FE-METRIC-005). Omitted when there is none. */
      trend?: number[];
      trendForecastFrom?: number;
      /** Where the card leads, announced to assistive tech (FE §156). */
      destination?: string;
      tone?: "neutral" | "critical" | "warning";
      /**
       * METRIC-ALIGN-001/§85: the large value is centred in its own zone by default;
       * the header and supporting line keep the card's normal left axis.
       */
      valueAlign?: "left" | "center";
      /** §28: long values (e.g. a range) may drop one step rather than clip. */
      valueSize?: "default" | "compact";
    }
);

/**
 * MetricCard. Two variants of one component so every KPI surface shares one anatomy:
 * `compact` for scan-first four-card strips, `detailed` where the card carries context.
 */
export function MetricCard(props: MetricCardProps) {
  if (props.variant === "compact") return <CompactMetricCard {...props} />;
  return <DetailedMetricCard {...props} />;
}

function CompactMetricCard({
  label,
  value,
  unit,
  delta,
  href,
  tooltip,
  className,
  icon: Icon,
  exactValue,
  comparison,
  meta,
  trend,
  trendForecastFrom,
  destination,
  tone = "neutral",
  valueAlign = "center",
  valueSize = "default",
}: Extract<MetricCardProps, { variant: "compact" }>) {
  const descId = React.useId();
  const centered = valueAlign === "center";
  const labelEl = (
    <span className={cn("line-clamp-2 min-w-0 text-[0.8125rem] font-semibold text-fg-secondary", tooltip && "underline decoration-border-strong decoration-dotted underline-offset-4")}>{label}</span>
  );
  const body = (
    <>
      {/* Header keeps a fixed height (§44) so a two-line label never moves the value. */}
      <div className="flex min-h-10 min-w-0 items-center gap-2">
        {Icon && (
          <Icon
            className={cn("size-4 shrink-0", tone === "critical" ? "text-critical" : tone === "warning" ? "text-warning" : "text-fg-tertiary")}
            aria-hidden
          />
        )}
        {tooltip ? (
          <Tooltip content={tooltip}>
            {href ? labelEl : <span tabIndex={0} className="min-w-0 rounded-xs focus-visible:outline-2 focus-visible:outline-focus">{labelEl}</span>}
          </Tooltip>
        ) : (
          labelEl
        )}
        {/* §90: the affordance sits in the header corner, never beside the number. */}
        {href && <ArrowUpRight className="ml-auto size-4 shrink-0 text-fg-tertiary opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />}
      </div>
      {/* Value zone (METRIC-ALIGN-004): fixed height, value centred, no truncation. */}
      <div className={cn("mt-5 flex min-h-[72px] min-w-0 flex-col justify-center", centered && "items-center text-center")}>
        <span className={cn("flex min-w-0 flex-wrap items-baseline gap-x-1.5", centered && "justify-center")}>
          <span className={cn(valueSize === "compact" ? "numeric-lg" : "numeric-xl", "text-fg")} title={exactValue}>
            {value}
          </span>
          {unit && <span className="body-sm shrink-0 text-fg-tertiary">{unit}</span>}
        </span>
        {exactValue && <span className="sr-only">({exactValue})</span>}
        {trend && trend.length > 1 && (
          <span className="mt-1 hidden sm:block">
            <Sparkline values={trend} forecastFrom={trendForecastFrom} width={64} height={24} />
          </span>
        )}
      </div>
      {/* Support zone (§88): fixed height, left axis, bottom-aligned across the strip. */}
      <div className="mt-auto flex min-h-6 min-w-0 items-center gap-1.5 pt-3">
        {delta}
        {comparison && <span className="truncate caption text-fg-tertiary">{comparison}</span>}
        {!delta && !comparison && meta && <span className="truncate caption">{meta}</span>}
      </div>
      {(delta || comparison) && meta && <div className="mt-1 truncate caption">{meta}</div>}
      {href && destination && <span className="sr-only">, {destination}</span>}
      {href && tooltip && typeof tooltip === "string" && (
        <span id={descId} className="sr-only">
          {tooltip}
        </span>
      )}
    </>
  );
  const cls = cn("group flex h-full min-h-44 min-w-0 flex-col rounded-lg border border-border bg-surface p-5", className);
  if (href) {
    return (
      <Link
        href={href}
        aria-describedby={tooltip && typeof tooltip === "string" ? descId : undefined}
        className={cn(cls, "transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus")}
      >
        {body}
      </Link>
    );
  }
  return <div className={cls}>{body}</div>;
}

function DetailedMetricCard({
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
  valueAlign = "center",
}: Extract<MetricCardProps, { variant?: "detailed" }>) {
  const centered = valueAlign === "center";
  const body = (
    <>
      <div className="flex min-h-6 items-center justify-between gap-2">
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
      {/* Value zone: same fixed height and centring as the compact variant (§99). */}
      <div className={cn("mt-1 flex min-h-[64px] min-w-0 flex-col justify-center", centered && "items-center text-center")}>
        <span className={cn("flex min-w-0 flex-wrap items-baseline gap-x-1.5", centered && "justify-center")}>
          <span className="numeric-lg text-fg">{value}</span>
          {unit && <span className="body-sm shrink-0 text-fg-tertiary">{unit}</span>}
        </span>
      </div>
      {context && <div className="mt-auto min-h-6 pt-2 caption">{context}</div>}
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
  comparisonLabel: comparisonLabelProp,
  unit: unitProp,
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
  const comparisonLabel = comparisonLabelProp ?? pick("Perkiraan sebelumnya", "Previous run");
  const unit = unitProp ?? pick("unit", "units");
  const values = [lower, upper, forecast, comparison ?? forecast, override ?? forecast];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.12 || Math.max(1, forecast * 0.1);
  const lo = Math.max(0, min - pad);
  const hi = max + pad;
  const pos = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
  return (
    <figure className={cn("flex flex-col gap-2", className)} aria-label={pick(`Perkiraan ${formatNumber(forecast)} ${unit}; rentang ${Math.round(coverage * 100)}% ${formatNumber(lower)} sampai ${formatNumber(upper)} ${unit}${comparison != null ? `; ${comparisonLabel.toLowerCase()} ${formatNumber(comparison)} ${unit}` : ""}`, `Forecast ${formatNumber(forecast)} ${unit}; ${Math.round(coverage * 100)}% prediction interval ${formatNumber(lower)} to ${formatNumber(upper)} ${unit}${comparison != null ? `; ${comparisonLabel.toLowerCase()} ${formatNumber(comparison)} ${unit}` : ""}`)}>
      <div className="relative mx-6 h-[4.5rem]" aria-hidden>
        {/* axis */}
        <div className="absolute inset-x-0 top-7 h-px bg-border" />
        {/* interval band */}
        <div className="absolute top-5 h-4 rounded-xs border bg-[var(--chart-interval)]" style={{ left: pos(lower), width: `calc(${pos(upper)} - ${pos(lower)})`, borderColor: "color-mix(in srgb, var(--chart-forecast) 45%, transparent)" }} />
        {/* bounds */}
        <Marker at={pos(lower)} label={pick("Bawah", "Lower")} value={formatNumber(lower)} align="below" tone="muted" />
        <Marker at={pos(upper)} label={pick("Atas", "Upper")} value={formatNumber(upper)} align="below" tone="muted" />
        {/* forecast */}
        <Marker at={pos(forecast)} label={pick("Perkiraan", "Forecast")} value={formatNumber(forecast)} align="above" tone="forecast" />
        {comparison != null && <Marker at={pos(comparison)} label={comparisonLabel} value="" align="tick" tone="previous" />}
        {override != null && <Marker at={pos(override)} label={pick("Ubah manual", "Override")} value="" align="tick" tone="override" />}
      </div>
      <figcaption className="flex flex-wrap gap-x-4 gap-y-1 caption">
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded-xs border" style={{ background: "var(--chart-interval)", borderColor: "color-mix(in srgb, var(--chart-forecast) 45%, transparent)" }} />
          {pick(`Rentang perkiraan ${Math.round(coverage * 100)}%`, `${Math.round(coverage * 100)}% prediction interval`)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-0.5" style={{ background: "var(--chart-forecast)" }} />
          {pick("Perkiraan", "Forecast")}
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
            {pick("Ubah manual", "Override")}: {formatNumber(override)}
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
