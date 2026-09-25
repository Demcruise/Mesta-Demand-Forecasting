/**
 * Product-wide formatting (backlog §65, v3 §8).
 * Supports English (en-US, default) and Indonesian (id-ID) conventions.
 */

export type FormatLocale = "en" | "id";

let currentLocale: FormatLocale = "en";

export function getFormatLocale(): FormatLocale {
  return currentLocale;
}

export function setFormatLocale(locale: FormatLocale) {
  currentLocale = locale;
  const tag = locale === "id" ? "id-ID" : "en-US";
  integer = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 });
  compact = new Intl.NumberFormat(tag, { notation: "compact", maximumFractionDigits: 1 });
  oneDecimal = new Intl.NumberFormat(tag, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

let integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
let compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
let oneDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return integer.format(Math.round(value));
}

export function formatCompact(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return compact.format(value);
}

export function formatUnits(value: number | null | undefined, unit = currentLocale === "id" ? "unit" : "units") {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value)} ${unit}`;
}

/** `ratio` is a fraction (0.045 → "4.5%" or "4,5%"). */
export function formatPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  const num = (ratio * 100).toFixed(digits);
  return `${currentLocale === "id" ? num.replace(".", ",") : num}%`;
}

/** Signed percentage for deltas: +4.5%, −3.2%, 0.0% (en) or +4,5%, −3,2%, 0,0% (id). */
export function formatDeltaPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  const pct = ratio * 100;
  const rounded = Number(pct.toFixed(digits));
  const val = (rounded === 0 ? (0).toFixed(digits) : Math.abs(rounded).toFixed(digits));
  const formatted = currentLocale === "id" ? val.replace(".", ",") : val;
  if (rounded === 0) return `${formatted}%`;
  return `${rounded > 0 ? "+" : "−"}${formatted}%`;
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

const MONTHS_ID = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const MONTHS_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatDate(value: string | number | Date | null | undefined) {
  if (value == null) return "—";
  const d = toDate(value);
  const months = currentLocale === "id" ? MONTHS_ID : MONTHS_EN;
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatShortDate(value: string | number | Date | null | undefined) {
  if (value == null) return "—";
  const d = toDate(value);
  const months = currentLocale === "id" ? MONTHS_ID : MONTHS_EN;
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** 24-hour clock with a colon, matching the backlog examples ("14:05"). */
function time(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function formatDateTime(value: string | number | Date | null | undefined) {
  if (value == null) return "—";
  const d = toDate(value);
  return `${formatDate(d)}, ${time(d)}`;
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
  if (currentLocale === "id") {
    if (s < 60) return `${s} dtk`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} mnt ${s % 60} dtk`;
    const h = Math.floor(m / 60);
    return `${h} j ${m % 60} mnt`;
  }
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function formatRelative(value: string | number | Date | null | undefined, now: number = Date.now()) {
  if (value == null) return "—";
  const diff = toDate(value).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat(currentLocale === "id" ? "id" : "en", { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return currentLocale === "id" ? "baru saja" : "just now";
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(value);
}

export function pluralize(count: number, singular: string, plural?: string) {
  if (currentLocale === "id") {
    return `${formatNumber(count)} ${plural ?? singular}`;
  }
  const word = count === 1 ? singular : (plural ?? `${singular}s`);
  return `${formatNumber(count)} ${word}`;
}
