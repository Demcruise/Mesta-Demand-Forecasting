/**
 * Product-wide formatting (backlog §65). One convention per value type:
 * - quantities: grouped integers, unit shown where ambiguous
 * - percentages: one decimal, explicit sign for deltas
 * - dates: "25 Sep 2026"; date-times: "25 Sep 2026, 14:05"
 */

const LOCALE = "en-GB";

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const oneDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return integer.format(Math.round(value));
}

export function formatCompact(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return compact.format(value);
}

export function formatUnits(value: number | null | undefined, unit = "units") {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value)} ${unit}`;
}

/** `ratio` is a fraction (0.045 → "4.5%"). */
export function formatPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Signed percentage for deltas: +4.5%, −3.2%, 0.0%. Uses a true minus sign. */
export function formatDeltaPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  const pct = ratio * 100;
  const rounded = Number(pct.toFixed(digits));
  if (rounded === 0) return `${(0).toFixed(digits)}%`;
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits)}%`;
}

export function formatDeltaNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  const r = Math.round(value);
  if (r === 0) return "0";
  return `${r > 0 ? "+" : "−"}${integer.format(Math.abs(r))}`;
}

export function formatDecimal(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return oneDecimal.format(value);
}

function toDate(value: string | number | Date) {
  return value instanceof Date ? value : new Date(value);
}

// Fixed three-letter months: locale data varies ("Sep" vs "Sept"), the product must not.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value: string | number | Date | null | undefined) {
  if (value == null) return "—";
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(value: string | number | Date | null | undefined) {
  if (value == null) return "—";
  const d = toDate(value);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (value == null) return "—";
  const d = toDate(value);
  return `${formatDate(d)}, ${d.toLocaleTimeString(LOCALE, { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

export function formatDateRange(start: string | Date, end: string | Date) {
  const s = toDate(start);
  const e = toDate(end);
  if (s.getFullYear() === e.getFullYear()) {
    return `${formatShortDate(s)} – ${formatDate(e)}`;
  }
  return `${formatDate(s)} – ${formatDate(e)}`;
}

export function formatDuration(ms: number) {
  if (ms < 0 || Number.isNaN(ms)) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** "15 minutes ago", "4 days ago", "in 2 days". */
export function formatRelative(value: string | number | Date | null | undefined, now: number = Date.now()) {
  if (value == null) return "—";
  const diff = toDate(value).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "just now";
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(value);
}

export function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
