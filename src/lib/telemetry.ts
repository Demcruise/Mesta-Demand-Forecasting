/**
 * Product telemetry (backlog §72). Captures event names and non-sensitive properties
 * only — never free text, product quantities or personal data. Telemetry supports
 * product improvement and is not a substitute for the audit log.
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

const buffer: { event: TelemetryEvent; props: Props; at: number }[] = [];

export function track(event: TelemetryEvent, props: Props = {}) {
  buffer.push({ event, props, at: Date.now() });
  if (buffer.length > 200) buffer.shift();
  if (process.env.NODE_ENV === "development") {
    console.debug(`[telemetry] ${event}`, props);
  }
}

export function recentTelemetry() {
  return [...buffer];
}
