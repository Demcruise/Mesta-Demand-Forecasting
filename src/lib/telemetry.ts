/**
 * Product telemetry (backlog §72). Captures event names and non-sensitive properties
 * only — never free text, product quantities or personal data. Telemetry supports
 * product improvement and is not a substitute for the audit log.
 *
 * Events are buffered locally (for debugging) and delivered in batches through a
 * pluggable transport. A transport is installed by the browser bootstrap; with no
 * transport the buffer still records, so nothing throws in tests or on the server.
 */

export type TelemetryEvent =
  | "page_view"
  | "forecast_run_started"
  | "forecast_run_completed"
  | "forecast_run_failed"
  | "forecast_opened"
  | "scenario_created"
  | "scenario_simulated"
  | "exception_opened"
  | "exception_resolved"
  | "override_started"
  | "override_applied"
  | "approval_opened"
  | "approval_completed"
  | "filter_used"
  | "export_requested"
  | "workspace_switched"
  | "sign_in"
  | "sign_out"
  | "command_menu_opened";

type Props = Record<string, string | number | boolean | null | undefined>;
export type TelemetryProps = Record<string, string | number | boolean | null>;
export type TelemetryRecord = { event: TelemetryEvent; props: TelemetryProps; at: number };
export type TelemetryTransport = (records: TelemetryRecord[]) => void | Promise<void>;

/** Property keys that may carry free text or personal data: never delivered. */
const REDACTED = new Set(["email", "name", "user", "comment", "reason", "evidence", "note", "rationale", "query", "q", "search", "url", "text"]);

const BUFFER_MAX = 200;
const BATCH_SIZE = 20;
const FLUSH_MS = 5000;

const buffer: TelemetryRecord[] = [];
let pending: TelemetryRecord[] = [];
let transport: TelemetryTransport | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;

function sanitize(props: Props): TelemetryProps {
  const out: TelemetryProps = {};
  for (const [key, value] of Object.entries(props)) {
    if (REDACTED.has(key.toLowerCase())) continue;
    if (value === null || value === undefined) out[key] = null;
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else out[key] = String(value).slice(0, 64);
  }
  return out;
}

/** Installs the delivery transport. Passing null stops delivery (buffering continues). */
export function setTelemetryTransport(next: TelemetryTransport | null) {
  transport = next;
  if (next) schedule();
}

function schedule() {
  if (!transport) return;
  if (pending.length >= BATCH_SIZE) {
    void flushTelemetry();
    return;
  }
  if (timer) return;
  timer = setTimeout(() => void flushTelemetry(), FLUSH_MS);
}

export function track(event: TelemetryEvent, props: Props = {}) {
  const record: TelemetryRecord = { event, props: sanitize(props), at: Date.now() };
  buffer.push(record);
  if (buffer.length > BUFFER_MAX) buffer.shift();
  if (process.env.NODE_ENV === "development") console.debug(`[telemetry] ${event}`, record.props);
  pending.push(record);
  if (pending.length > BUFFER_MAX) pending.shift();
  schedule();
}

/** Delivers any queued events. Safe to call at any time; failures are swallowed. */
export async function flushTelemetry() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!transport || pending.length === 0) return;
  const batch = pending;
  pending = [];
  try {
    await transport(batch);
  } catch {
    // Telemetry must never break the product; the events stay out of the buffer.
  }
}

export function recentTelemetry() {
  return [...buffer];
}

/**
 * Browser bootstrap: batch events to the collector endpoint, flush when the tab is
 * hidden, and use `sendBeacon` so the last batch survives navigation.
 * Override the sink with NEXT_PUBLIC_TELEMETRY_ENDPOINT.
 */
export function installBrowserTransport(endpoint?: string) {
  if (typeof window === "undefined") return;
  const url = endpoint ?? process.env.NEXT_PUBLIC_TELEMETRY_ENDPOINT ?? "/api/telemetry";
  setTelemetryTransport((records) => {
    const body = JSON.stringify({ records });
    if (typeof navigator.sendBeacon === "function" && navigator.sendBeacon(url, new Blob([body], { type: "application/json" }))) return;
    void fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true }).catch(() => {});
  });
  const onHide = () => {
    if (document.visibilityState === "hidden") void flushTelemetry();
  };
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", () => void flushTelemetry());
}
