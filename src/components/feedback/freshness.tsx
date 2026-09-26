"use client";

import { Clock } from "lucide-react";
import * as React from "react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlay";
import { getActiveLocale } from "@/lib/i18n";

/**
 * FreshnessIndicator (FRESH-001). States: Fresh, Recent, Delayed, Stale, Unavailable.
 * Never shows freshness when the underlying timestamp is unknown — it says so instead.
 */

export type FreshnessState = "fresh" | "recent" | "delayed" | "stale" | "unavailable";

const HOUR = 3_600_000;

export function freshnessState(timestamp: string | null | undefined, now = Date.now(), thresholds = { fresh: 2, recent: 24, delayed: 48 }): FreshnessState {
  if (!timestamp) return "unavailable";
  const age = (now - new Date(timestamp).getTime()) / HOUR;
  if (age <= thresholds.fresh) return "fresh";
  if (age <= thresholds.recent) return "recent";
  if (age <= thresholds.delayed) return "delayed";
  return "stale";
}

const COPY_ID: Record<FreshnessState, { label: string; note: string; dot: string; text: string }> = {
  fresh: { label: "Terbaru", note: "Data masih baru.", dot: "bg-success", text: "text-fg-secondary" },
  recent: { label: "Baru saja", note: "Diperbarui dalam 24 jam terakhir.", dot: "bg-info", text: "text-fg-secondary" },
  delayed: { label: "Terlambat", note: "Lebih dari 24 jam. Periksa jadwal sumber data.", dot: "bg-warning", text: "text-warning-fg" },
  stale: { label: "Usang", note: "Sumber data mungkin sudah lama. Keputusan dapat memakai data lama.", dot: "bg-critical", text: "text-critical-fg" },
  unavailable: { label: "Tidak tersedia", note: "Waktu pembaruan data ini tidak diketahui.", dot: "bg-fg-disabled", text: "text-fg-tertiary" },
};

const COPY_EN: Record<FreshnessState, { label: string; note: string; dot: string; text: string }> = {
  fresh: { label: "Fresh", note: "Data is up to date.", dot: "bg-success", text: "text-fg-secondary" },
  recent: { label: "Recent", note: "Updated in the last 24 hours.", dot: "bg-info", text: "text-fg-secondary" },
  delayed: { label: "Delayed", note: "Over 24 hours old. Check data source schedule.", dot: "bg-warning", text: "text-warning-fg" },
  stale: { label: "Stale", note: "Data source may be degraded. Decisions may use stale data.", dot: "bg-critical", text: "text-critical-fg" },
  unavailable: { label: "Unavailable", note: "Update time for this data is unknown.", dot: "bg-fg-disabled", text: "text-fg-tertiary" },
};

/** Re-renders every minute so relative times do not drift. */
function useNow(intervalMs = 60_000) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function FreshnessIndicator({
  timestamp,
  label,
  source,
  className,
  variant = "inline",
  thresholds,
}: {
  timestamp: string | null | undefined;
  label?: string;
  source?: string;
  className?: string;
  /** cell: label and relative time on separate lines, for fixed-width summary cells. */
  variant?: "inline" | "stacked" | "cell";
  thresholds?: { fresh: number; recent: number; delayed: number };
}) {
  const isId = getActiveLocale() === "id";
  const defaultLabel = isId ? "Diperbarui" : "Updated";
  const effectiveLabel = label ?? defaultLabel;
  const now = useNow();
  const state = freshnessState(timestamp, now, thresholds);
  const copy = isId ? COPY_ID[state] : COPY_EN[state];
  const text = timestamp ? `${effectiveLabel} ${formatRelative(timestamp, now)}` : (isId ? "Waktu pembaruan tidak diketahui" : "Update time unknown");
  const tooltip = (
    <span className="flex flex-col gap-0.5">
      <span className="font-semibold">{copy.label}</span>
      {timestamp && <span>{formatDateTime(timestamp)}</span>}
      {source && <span>{isId ? "Sumber: " : "Source: "}{source}</span>}
      <span>{copy.note}</span>
    </span>
  );
  if (variant === "cell") {
    return (
      <Tooltip content={tooltip}>
        <div tabIndex={0} className={cn("flex min-w-0 flex-col rounded-xs focus-visible:outline-2 focus-visible:outline-focus", className)} aria-label={`${text}. ${copy.label}. ${copy.note}`}>
          <span className="inline-flex min-w-0 items-center gap-1.5 body-sm font-semibold text-fg">
            {state === "unavailable" ? <Clock className="size-3.5 shrink-0" aria-hidden /> : <span className={cn("size-2 shrink-0 rounded-full", copy.dot)} aria-hidden />}
            <span className="truncate">{effectiveLabel}</span>
          </span>
          <span className={cn("caption", copy.text)}>{timestamp ? formatRelative(timestamp, now) : isId ? "Waktu tidak diketahui" : "Time unknown"}</span>
        </div>
      </Tooltip>
    );
  }
  if (variant === "stacked") {
    return (
      <div className={cn("flex flex-col", className)}>
        <span className={cn("inline-flex items-center gap-1.5 body-sm font-semibold", copy.text)}>
          <span className={cn("size-2 rounded-full", copy.dot)} aria-hidden />
          {text}
        </span>
        <span className="caption">{copy.note}</span>
      </div>
    );
  }
  return (
    <Tooltip content={tooltip}>
      <span
        tabIndex={0}
        className={cn("inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs font-medium", copy.text, className)}
        aria-label={`${text}. ${copy.label}. ${copy.note}`}
      >
        {state === "unavailable" ? <Clock className="size-3.5" aria-hidden /> : <span className={cn("size-2 shrink-0 rounded-full", copy.dot)} aria-hidden />}
        <span className="truncate">{text}</span>
      </span>
    </Tooltip>
  );
}
