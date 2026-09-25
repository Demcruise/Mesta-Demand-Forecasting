"use client";

import { Clock } from "lucide-react";
import * as React from "react";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/overlay";

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

const COPY: Record<FreshnessState, { label: string; note: string; dot: string; text: string }> = {
  fresh: { label: "Fresh", note: "Data is considered fresh.", dot: "bg-success", text: "text-fg-secondary" },
  recent: { label: "Recent", note: "Updated within the last 24 hours.", dot: "bg-info", text: "text-fg-secondary" },
  delayed: { label: "Delayed", note: "Older than 24 hours. Check the source schedule.", dot: "bg-warning", text: "text-warning-fg" },
  stale: { label: "Stale", note: "Source may be stale. Decisions may use outdated data.", dot: "bg-critical", text: "text-critical-fg" },
  unavailable: { label: "Unavailable", note: "The update time for this data is unknown.", dot: "bg-fg-disabled", text: "text-fg-tertiary" },
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
  label = "Updated",
  source,
  className,
  variant = "inline",
  thresholds,
}: {
  timestamp: string | null | undefined;
  label?: string;
  source?: string;
  className?: string;
  variant?: "inline" | "stacked";
  thresholds?: { fresh: number; recent: number; delayed: number };
}) {
  const now = useNow();
  const state = freshnessState(timestamp, now, thresholds);
  const copy = COPY[state];
  const text = timestamp ? `${label} ${formatRelative(timestamp, now)}` : "Update time unknown";
  const tooltip = (
    <span className="flex flex-col gap-0.5">
      <span className="font-semibold">{copy.label}</span>
      {timestamp && <span>{formatDateTime(timestamp)}</span>}
      {source && <span>Source: {source}</span>}
      <span>{copy.note}</span>
    </span>
  );
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
