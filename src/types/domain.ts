/**
 * Conceptual data contracts (backlog §61). These are proposals: every field must be
 * aligned with the backend once real API contracts exist (backlog §93 item 24).
 */

/* ── Identity & access ─────────────────────────────────────────────── */

export type Role = "viewer" | "planner" | "manager" | "analyst" | "admin";

export type Environment = "Production" | "Staging" | "Sandbox";

export type Workspace = {
  id: string;
  name: string;
  organization: string;
  environment: Environment;
  region: string;
  status: "active" | "degraded" | "maintenance";
};

export type User = {
  id: string;
  name: string;
  email: string;
  title: string;
  role: Role;
  workspaceIds: string[];
  status: "active" | "invited" | "suspended";
  lastActiveAt: string | null;
};

export type Session = {
  userId: string;
  name: string;
  email: string;
  role: Role;
  workspaceId: string | null;
  organization: string;
  idp: string;
  issuedAt: number;
  expiresAt: number;
};

/* ── Catalogue ─────────────────────────────────────────────────────── */

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  subcategory: string;
  brand: string;
  unit: string;
  lifecycle: "new" | "core" | "seasonal" | "end-of-life";
  launchedAt: string;
};

export type Location = {
  id: string;
  name: string;
  region: string;
  storeGroup: string;
};

/* ── Status system (STATUS-001) ────────────────────────────────────── */

export type StatusKey =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "published"
  | "approved"
  | "rejected"
  | "needs_review"
  | "failed"
  | "paused"
  | "archived"
  | "stale"
  | "unavailable"
  | "cancelled"
  | "pending"
  | "open"
  | "investigating"
  | "resolved"
  | "dismissed"
  | "escalated"
  | "revision_requested"
  | "in_review"
  | "simulated"
  | "connected"
  | "syncing"
  | "warning"
  | "disconnected"
  | "active"
  | "invited"
  | "suspended"
  | "production"
  | "candidate"
  | "training"
  | "overridden"
  | "normal";

export type Severity = "info" | "warning" | "critical";

/* ── Forecasting ───────────────────────────────────────────────────── */

export type ForecastRunStatus =
  | "draft"
  | "queued"
  | "running"
  | "completed"
  | "published"
  | "failed"
  | "cancelled"
  | "archived";

export type ForecastScope = {
  businessUnit: string;
  regions: string[];
  categories: string[];
  skuCount: number;
  locationCount: number;
};

export type RunStepKey = "queued" | "loading" | "validating" | "modelling" | "generating" | "writing";

export type RunStep = {
  key: RunStepKey;
  label: string;
  status: "pending" | "running" | "completed" | "failed" | "skipped";
  startedAt: string | null;
  completedAt: string | null;
  detail: string | null;
};

export type Frequency = "daily" | "weekly";

export type ForecastRun = {
  id: string;
  name: string;
  status: ForecastRunStatus;
  scope: ForecastScope;
  modelId: string;
  modelVersion: string;
  historicalStart: string;
  historicalEnd: string;
  horizonDays: number;
  frequency: Frequency;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  createdBy: string;
  dataAsOf: string | null;
  steps: RunStep[];
  warnings: string[];
  failureReason: string | null;
  publishedAt: string | null;
};

export type ForecastPoint = {
  date: string;
  actual?: number;
  forecast?: number;
  lowerBound?: number;
  upperBound?: number;
  previousForecast?: number;
};

export type ForecastRowStatus = "normal" | "needs_review" | "overridden" | "approved";

/** One row of the Forecast Explorer: a product's forecast over the run horizon. */
export type ForecastRow = {
  id: string;
  runId: string;
  productId: string;
  forecast: number;
  previousForecast: number;
  actualLastPeriod: number;
  delta: number;
  deltaPercent: number;
  lowerBound: number;
  upperBound: number;
  coverage: number;
  trend: number[];
  status: ForecastRowStatus;
  exceptionCount: number;
  overrideUnits: number | null;
  updatedAt: string;
};

export type ForecastSummary = {
  forecastValue: number;
  previousForecast: number;
  actualLastPeriod: number;
  delta: number;
  deltaPercent: number;
  lowerBound: number;
  upperBound: number;
  coverage: number;
  horizonDays: number;
  periodStart: string;
  periodEnd: string;
};

/* ── Models ────────────────────────────────────────────────────────── */

export type ModelStatus = "production" | "candidate" | "training" | "archived";

export type ForecastModel = {
  id: string;
  name: string;
  family: string;
  version: string;
  status: ModelStatus;
  isDefault: boolean;
  lastTrainedAt: string;
  trainingStart: string;
  trainingEnd: string;
  horizonDays: number;
  frequency: Frequency;
  owner: string;
  dataset: string;
  features: string[];
  limitations: string[];
  metrics: ModelMetrics;
  usage: { runs: number; lastUsedAt: string | null };
};

export type ModelMetrics = {
  /** Weighted absolute percentage error, fraction. */
  wape: number;
  /** Mean signed error / mean actual, fraction. Positive = over-forecast. */
  bias: number;
  mae: number;
  rmse: number;
  /** Share of actuals inside the 80% prediction interval, fraction. */
  coverage80: number;
  evaluationStart: string;
  evaluationEnd: string;
  population: string;
};

export type Backtest = {
  id: string;
  modelId: string;
  modelVersion: string;
  windowStart: string;
  windowEnd: string;
  frequency: Frequency;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  createdBy: string;
  metrics: ModelMetrics | null;
  segments: { segment: string; wape: number; bias: number; volumeShare: number }[];
  points: ForecastPoint[];
  errorBuckets: { bucket: string; count: number }[];
};

/* ── Demand data ───────────────────────────────────────────────────── */

export type DemandRecord = {
  id: string;
  date: string;
  productId: string;
  locationId: string;
  units: number;
  sourceId: string;
  quality: "ok" | "warning" | "blocking";
  updatedAt: string;
};

export type DataSourceType = "ERP" | "POS" | "Data warehouse" | "Promotions calendar" | "File upload";

export type DataSource = {
  id: string;
  name: string;
  type: DataSourceType;
  status: "connected" | "syncing" | "warning" | "failed" | "disconnected";
  schedule: string;
  lastSyncAt: string | null;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
  records: number;
  owner: string;
  mapping: { source: string; target: string }[];
  description: string;
};

export type DataQualityIssueType =
  | "missing_records"
  | "duplicate_records"
  | "missing_dimensions"
  | "late_data"
  | "unexpected_zero"
  | "extreme_outlier"
  | "schema_mismatch"
  | "source_unavailable";

export type DataQualityIssue = {
  id: string;
  type: DataQualityIssueType;
  severity: "blocking" | "warning" | "info";
  sourceId: string;
  title: string;
  description: string;
  affectedSkus: number;
  affectedLocations: number;
  detectedAt: string;
  status: "open" | "investigating" | "resolved" | "dismissed";
  ownerId: string | null;
  forecastImpact: string;
  recommendedAction: string;
  sampleProductIds: string[];
};

/* ── Scenarios & planning ──────────────────────────────────────────── */

export type ScenarioDriver =
  | "demand_change"
  | "price"
  | "promotion"
  | "seasonality"
  | "external"
  | "availability"
  | "regional"
  | "lifecycle";

export type Assumption = {
  id: string;
  driver: ScenarioDriver;
  scope: string;
  baselineValue: number;
  value: number;
  unit: "%" | "pp" | "days";
  rationale: string;
};

export type ScenarioStatus = "draft" | "simulated" | "in_review" | "approved" | "rejected" | "archived";

export type Scenario = {
  id: string;
  name: string;
  description: string;
  baselineRunId: string;
  ownerId: string;
  status: ScenarioStatus;
  createdAt: string;
  modifiedAt: string;
  assumptions: Assumption[];
  result: ScenarioResult | null;
};

export type ScenarioResult = {
  simulatedAt: string;
  baselineUnits: number;
  scenarioUnits: number;
  deltaUnits: number;
  deltaPercent: number;
  lowerBound: number;
  upperBound: number;
  points: { date: string; baseline: number; scenario: number }[];
  byCategory: { category: string; baseline: number; scenario: number }[];
};

export type PlanDecision = "pending" | "accepted" | "adjusted" | "rejected" | "flagged";

export type PlanLine = {
  id: string;
  productId: string;
  forecast: number;
  proposed: number;
  decision: PlanDecision;
  note: string | null;
  exceptionCount: number;
};

export type Plan = {
  id: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  baselineRunId: string;
  status: "draft" | "in_review" | "published";
  ownerId: string;
  updatedAt: string;
  lines: PlanLine[];
};

export type Override = {
  id: string;
  productIds: string[];
  runId: string;
  originalUnits: number;
  newUnits: number;
  reason: OverrideReason;
  evidence: string;
  comment: string;
  userId: string;
  createdAt: string;
  status: "applied" | "pending_approval" | "rejected";
  approvalId: string | null;
};

export type OverrideReason =
  | "promotion_not_in_model"
  | "supply_constraint"
  | "new_listing"
  | "known_event"
  | "data_issue"
  | "other";

export type ExceptionType =
  | "large_delta"
  | "low_confidence"
  | "high_error"
  | "data_freshness"
  | "data_quality"
  | "model_anomaly"
  | "manual_override"
  | "threshold_breach";

export type ForecastException = {
  id: string;
  type: ExceptionType;
  severity: Severity;
  productId: string;
  runId: string;
  value: number;
  threshold: number;
  valueUnit: "%" | "units" | "days";
  detectedAt: string;
  ownerId: string | null;
  status: "open" | "investigating" | "resolved" | "dismissed" | "escalated";
  reason: string;
  affectedSkus: number;
  activity: ActivityItem[];
};

export type ActivityItem = {
  id: string;
  at: string;
  actorId: string;
  text: string;
};

export type ApprovalType = "override" | "scenario" | "plan_publish" | "model_default";

export type Approval = {
  id: string;
  type: ApprovalType;
  objectId: string;
  objectLabel: string;
  requestedBy: string;
  requestedAt: string;
  dueAt: string;
  status: "pending" | "approved" | "rejected" | "revision_requested";
  impact: { units: number; percent: number; skuCount: number; summary: string };
  changeSet: { field: string; from: string; to: string }[];
  evidence: string[];
  assumptions: string[];
  policy: { name: string; rule: string; requiredRole: Role };
  afterApproval: string;
  history: ActivityItem[];
};

/* ── Notifications, audit, monitoring ──────────────────────────────── */

export type NotificationCategory =
  | "forecast_completed"
  | "forecast_failed"
  | "data_quality"
  | "data_freshness"
  | "approval_requested"
  | "approval_completed"
  | "exception_opened"
  | "scenario_completed"
  | "model_issue";

export type AppNotification = {
  id: string;
  category: NotificationCategory;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  read: boolean;
};

export type AuditAction =
  | "sign_in"
  | "sign_out"
  | "workspace_switch"
  | "create_forecast_run"
  | "cancel_forecast_run"
  | "retry_forecast_run"
  | "publish_forecast_run"
  | "archive_forecast_run"
  | "approve"
  | "reject"
  | "request_revision"
  | "override"
  | "create_scenario"
  | "edit_scenario"
  | "simulate_scenario"
  | "submit_scenario"
  | "publish_plan"
  | "update_plan"
  | "resolve_exception"
  | "update_exception"
  | "change_settings"
  | "change_permissions"
  | "integration_update"
  | "run_backtest"
  | "set_default_model";

export type AuditEntityType =
  | "session"
  | "workspace"
  | "forecast_run"
  | "forecast"
  | "scenario"
  | "plan"
  | "exception"
  | "approval"
  | "override"
  | "model"
  | "backtest"
  | "data_source"
  | "user"
  | "settings";

export type AuditEvent = {
  eventId: string;
  timestamp: string;
  actorId: string;
  workspaceId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  previousState: string | null;
  newState: string | null;
  reason: string | null;
  source: "web" | "api" | "system";
  requestId: string;
};

export type ServiceHealth = {
  id: string;
  name: string;
  kind: "pipeline" | "source" | "model" | "service";
  status: "operational" | "degraded" | "down";
  detail: string;
  checkedAt: string;
  latencyMs: number | null;
};

export type Alert = {
  id: string;
  severity: Severity;
  title: string;
  detail: string;
  href: string;
  raisedAt: string;
  acknowledged: boolean;
};

/* ── Query contracts ───────────────────────────────────────────────── */

export type SortDirection = "asc" | "desc";

export type ListQuery = {
  q?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  dir?: SortDirection;
  filters?: Record<string, string[]>;
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  /** When the underlying data was last refreshed. */
  asOf: string | null;
};

/* ── Scheduling, API access, webhooks, saved views (P2) ────────────── */

export type ScheduleCadence = { type: "daily" } | { type: "weekly"; weekday: number };

export type ForecastSchedule = {
  id: string;
  name: string;
  cadence: ScheduleCadence;
  /** Local time, "HH:MM". */
  time: string;
  categories: string[];
  regions: string[];
  horizonDays: number;
  /** null means "use the workspace default model at run time". */
  modelId: string | null;
  /** Publish automatically when validation passes and no critical exceptions are raised. */
  autoPublish: boolean;
  enabled: boolean;
  ownerId: string;
  createdAt: string;
  lastRunId: string | null;
  lastRunAt: string | null;
};

export type ApiScope = "forecasts:read" | "runs:write" | "demand:write" | "plans:read" | "audit:read";

export type ApiKey = {
  id: string;
  name: string;
  prefix: string;
  scopes: ApiScope[];
  createdBy: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  status: "active" | "revoked" | "expired";
};

export type WebhookEvent = "forecast_run.completed" | "forecast_run.failed" | "forecast_run.published" | "approval.decided" | "plan.published" | "data_quality.blocking";

export type WebhookDelivery = {
  id: string;
  event: WebhookEvent;
  at: string;
  status: number;
  durationMs: number;
  attempt: number;
};

export type Webhook = {
  id: string;
  url: string;
  description: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdBy: string;
  createdAt: string;
  deliveries: WebhookDelivery[];
};

export type SavedView = {
  id: string;
  name: string;
  surface: "explorer" | "exceptions" | "runs";
  query: string;
  ownerId: string;
  shared: boolean;
  createdAt: string;
};

export type NotificationChannel = "in_app" | "email";

export type NotificationRules = {
  channels: Record<NotificationCategory, NotificationChannel[]>;
  quietHours: { enabled: boolean; start: string; end: string };
  minExceptionSeverity: Severity;
  digest: "off" | "daily" | "weekly";
};
