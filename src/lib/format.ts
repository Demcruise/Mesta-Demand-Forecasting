/**
 * Product-wide formatting (backlog §65, v3 §8). One convention per value type,
 * following Indonesian conventions:
 * - quantities: grouped integers with "." as the thousands separator ("124.300 unit")
 * - percentages: one decimal with a comma and an explicit sign for deltas ("+4,5%")
 * - dates: "25 Sep 2026"; date-times: "25 Sep 2026, 14:05"
 */

const LOCALE = "id-ID";

const integer = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat(LOCALE, { notation: "compact", maximumFractionDigits: 1 });
const oneDecimal = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export function formatNumber(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return integer.format(Math.round(value));
}

export function formatCompact(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) return "—";
  return compact.format(value);
}

export function formatUnits(value: number | null | undefined, unit = "unit") {
  if (value == null || Number.isNaN(value)) return "—";
  return `${formatNumber(value)} ${unit}`;
}

/** `ratio` is a fraction (0.045 → "4,5%"). */
export function formatPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  return `${(ratio * 100).toFixed(digits).replace(".", ",")}%`;
}

/** Signed percentage for deltas: +4,5%, −3,2%, 0,0%. Uses a true minus sign. */
export function formatDeltaPercent(ratio: number | null | undefined, digits = 1) {
  if (ratio == null || Number.isNaN(ratio)) return "—";
  const pct = ratio * 100;
  const rounded = Number(pct.toFixed(digits));
  if (rounded === 0) return `${(0).toFixed(digits).replace(".", ",")}%`;
  return `${rounded > 0 ? "+" : "−"}${Math.abs(rounded).toFixed(digits).replace(".", ",")}%`;
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

// Fixed three-letter Indonesian months: locale data varies, the product must not.
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

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
  if (s < 60) return `${s} dtk`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} mnt ${s % 60} dtk`;
  const h = Math.floor(m / 60);
  return `${h} j ${m % 60} mnt`;
}

/** "15 menit yang lalu", "4 hari yang lalu", "dalam 2 hari". */
export function formatRelative(value: string | number | Date | null | undefined, now: number = Date.now()) {
  if (value == null) return "—";
  const diff = toDate(value).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "baru saja";
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 30 * day) return rtf.format(Math.round(diff / day), "day");
  return formatDate(value);
}

/** Indonesian does not inflect plurals, so the plural form is optional. */
export function pluralize(count: number, singular: string, plural?: string) {
  return `${formatNumber(count)} ${plural ?? singular}`;
}
