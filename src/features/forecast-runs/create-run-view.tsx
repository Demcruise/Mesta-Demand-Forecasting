"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, Loader2, Play } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import type { ForecastModel } from "@/types/domain";
import { createRun, defaultRunInput, getRun, previewScope, RUN_FORM_OPTIONS, runToInput, validateRun, type RunInput, type ValidationCheck } from "@/lib/api/forecasting";
import { listModelOptions } from "@/lib/api/models";
import { listDataQuality, listSources } from "@/lib/api/data";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDate, formatDateRange, formatNumber, formatPercent, pluralize } from "@/lib/format";
import { DAY_MS } from "@/lib/mock/time";
import { track } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { RadioCards } from "@/components/ui/controls";
import { MultiSelect } from "@/components/ui/multi-select";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { PageContainer, PageHeader, Panel } from "@/components/page/page";
import { WizardLayout, WizardPanel, WizardSteps, type WizardStep } from "@/components/workflows/wizard";
import { ErrorState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { StatusBadge } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { ConsequenceSummary } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";

const STEPS: WizardStep[] = [
  { key: "scope", label: "Define scope", description: "What to forecast" },
  { key: "period", label: "Data period", description: "History to learn from" },
  { key: "horizon", label: "Horizon", description: "How far ahead" },
  { key: "model", label: "Model", description: "Which model and version" },
  { key: "validate", label: "Validate data", description: "Check inputs" },
  { key: "review", label: "Review", description: "Confirm configuration" },
];

/** Large runs get an explicit consequence confirmation before starting (backlog §20). */
const HIGH_IMPACT_SKUS = 500;

/** PAGE-CREATE-FORECAST: scope → data period → horizon → model → validate → review → run. */
export function CreateRunView() {
  const router = useRouter();
  const params = useSearchParams();
  const fromId = params.get("from");
  const { ctx, can } = useSession();
  useBreadcrumbLeaf("New forecast run");
  const [step, setStep] = React.useState(0);
  const [completed, setCompleted] = React.useState<Set<number>>(new Set());
  const [input, setInput] = React.useState<RunInput>(() => ({ ...defaultRunInput(ctx), name: params.get("name") ?? "" }));
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [touchedName, setTouchedName] = React.useState(false);

  const source = useApiQuery(["run", fromId], (c) => getRun(c, fromId as string), { enabled: !!fromId });
  React.useEffect(() => {
    if (source.data) setInput(runToInput(source.data.run));
  }, [source.data]);

  const scope = useApiQuery(["scope-preview", input.regions, input.categories], (c) => previewScope(c, input), { keepPrevious: true });
  const models = useApiQuery(["model-options"], listModelOptions);
  const sources = useApiQuery(["sources"], listSources, { enabled: step === 1 });
  const dq = useApiQuery(["dq", "missing"], (c) => listDataQuality(c, { filters: { type: ["missing_records"], status: ["open", "investigating"] } }), { enabled: step === 1 });
  const validation = useApiQuery(["run-validation", input], (c) => validateRun(c, input), { enabled: step >= 4 });

  const create = useApiMutation((c, v: RunInput) => createRun(c, v), {
    invalidate: [["runs"], ["overview"]],
    success: (r) => `Forecast run ${r.id} queued`,
    successDescription: "Processing starts shortly. You can leave this page; you will be notified when it finishes.",
    failure: "The forecast run was not created.",
    onSuccess: (r) => {
      track("forecast_run_started", { horizon: r.horizonDays, skus: r.scope.skuCount });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });

  if (!can("forecast.run.create")) {
    return (
      <PageContainer width="narrow">
        <PageHeader title="Create forecast run" />
        <PermissionNotice permission="forecast.run.create" />
      </PageContainer>
    );
  }

  const set = <K extends keyof RunInput>(key: K, value: RunInput[K]) => setInput((prev) => ({ ...prev, [key]: value }));
  const selectedModel = models.data?.find((m) => m.id === input.modelId);
  const historyDays = Math.round((new Date(input.historicalEnd).getTime() - new Date(input.historicalStart).getTime()) / DAY_MS) + 1;
  const checks = validation.data ?? [];
  const blocking = checks.filter((c) => c.result === "blocking");
  const warnings = checks.filter((c) => c.result === "warning");
  const nameError = touchedName && input.name.trim().length === 0 ? "Name the run so it can be found later." : null;

  const stepValid = (i: number) => {
    if (i === 0) return input.name.trim().length > 0 && (scope.data?.skuCount ?? 0) > 0;
    if (i === 1) return historyDays >= 1 && input.historicalStart <= input.historicalEnd;
    if (i === 2) return input.horizonDays >= 1 && input.horizonDays <= 180;
    if (i === 3) return !!selectedModel;
    if (i === 4) return !validation.isPending && blocking.length === 0 && !validation.isError;
    return true;
  };

  const goNext = () => {
    if (step === 0) setTouchedName(true);
    if (!stepValid(step)) return;
    setCompleted((prev) => new Set(prev).add(step));
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const start = () => {
    if ((scope.data?.skuCount ?? 0) >= HIGH_IMPACT_SKUS) setConfirmOpen(true);
    else create.mutate(input);
  };

  const nextLabel = ["Set data period", "Configure horizon", "Choose model", "Validate data", "Review configuration"][step];
  const backLabel = ["", "Back to scope", "Back to data period", "Back to horizon", "Back to model", "Back to validation"][step];

  const summaryRows = [
    { label: "Name", value: input.name || "—" },
    { label: "Scope", value: `${input.businessUnit} · ${input.categories.length ? input.categories.join(", ") : "All categories"} · ${input.regions.length ? input.regions.join(", ") : "All regions"}` },
    { label: "Size", value: scope.data ? `${pluralize(scope.data.skuCount, "SKU")} × ${scope.data.locationCount} locations` : "…" },
    { label: "Historical period", value: `${formatDateRange(input.historicalStart, input.historicalEnd)} (${historyDays} days)` },
    { label: "Forecast horizon", value: `${input.horizonDays} days · ${input.frequency}` },
    { label: "Model", value: selectedModel ? `${selectedModel.name} ${selectedModel.version}` : "—" },
    { label: "Expected output", value: scope.data ? `${formatNumber(scope.data.skuCount * input.horizonDays)} SKU-day forecasts with 80% prediction intervals` : "…" },
    { label: "Known warnings", value: warnings.length ? warnings.map((w) => w.detail).join(" ") : "None", emphasis: warnings.length > 0 },
  ];

  return (
    <PageContainer>
      <PageHeader
        title={fromId ? "Create forecast run from a copy" : "Create forecast run"}
        description="Configure what to forecast, validate the inputs, then run. Nothing is published until a manager publishes the results."
      />
      {fromId && source.isError && <ErrorState compact what="The run to copy could not be loaded." error={source.error} />}
      <WizardLayout steps={<WizardSteps steps={STEPS} current={step} completed={completed} onSelect={setStep} />}>
        {step === 0 && (
          <WizardPanel
            title="Define scope"
            description="Choose the products and locations to forecast. Leave a dimension empty to include all of it."
            footer={
              <>
                <span className="caption tabular">{scope.data ? `${pluralize(scope.data.skuCount, "SKU")} · ${scope.data.locationCount} locations · ${formatNumber(scope.data.seriesCount)} series` : "Calculating scope…"}</span>
                <Button variant="primary" onClick={goNext}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            <div className="grid gap-5">
              <Field label="Run name" htmlFor="run-name" required error={nameError} hint="Shown in run lists, notifications and audit history.">
                <Input id="run-name" value={input.name} onChange={(e) => set("name", e.target.value)} onBlur={() => setTouchedName(true)} placeholder="e.g. Beverages · 60-day promo horizon" aria-invalid={!!nameError} aria-describedby={nameError ? "run-name-error" : "run-name-hint"} maxLength={80} />
              </Field>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Business unit" htmlFor="bu">
                  <Select id="bu" value={input.businessUnit} onValueChange={(v) => set("businessUnit", v)} options={RUN_FORM_OPTIONS.businessUnits.map((b) => ({ value: b, label: b }))} />
                </Field>
                <Field label="Categories" htmlFor="cats" hint="Empty means all categories.">
                  <MultiSelect id="cats" aria-describedby="cats-hint" value={input.categories} onChange={(v) => set("categories", v)} allLabel="All categories" options={RUN_FORM_OPTIONS.categories.map((c) => ({ value: c, label: c }))} placeholder="Search categories" />
                </Field>
                <Field label="Regions" htmlFor="regions" hint="Empty means all regions.">
                  <MultiSelect id="regions" aria-describedby="regions-hint" value={input.regions} onChange={(v) => set("regions", v)} allLabel="All regions" options={RUN_FORM_OPTIONS.regions.map((c) => ({ value: c, label: c }))} placeholder="Search regions" />
                </Field>
              </div>
              <div>
                <button type="button" onClick={() => setShowAdvanced((v) => !v)} className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-primary hover:underline" aria-expanded={showAdvanced}>
                  <ChevronDown className={cn("size-4 transition-transform", showAdvanced && "rotate-180")} aria-hidden />
                  {showAdvanced ? "Hide" : "Show"} store group, product group and SKU filters
                </button>
                {showAdvanced && (
                  <InlineAlert tone="info" title="Store group, product group and SKU filters are not available yet." className="mt-3">
                    These dimensions depend on the confirmed product and location hierarchy (backlog §93 items 3 and 4). Use categories and regions for now.
                  </InlineAlert>
                )}
              </div>
            </div>
          </WizardPanel>
        )}

        {step === 1 && (
          <WizardPanel
            title="Select data period"
            description="The historical window the model learns from."
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(1)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Historical start" htmlFor="hs" required>
                <Input id="hs" type="date" value={input.historicalStart} max={input.historicalEnd} onChange={(e) => set("historicalStart", e.target.value)} />
              </Field>
              <Field label="Historical end" htmlFor="he" required hint="Latest complete day of data.">
                <Input id="he" type="date" value={input.historicalEnd} min={input.historicalStart} onChange={(e) => set("historicalEnd", e.target.value)} />
              </Field>
              <Field label="Data source" htmlFor="src" hint="Demand combines POS and ERP orders. Configure sources in Data sources.">
                <Select id="src" value="combined" onValueChange={() => undefined} options={[{ value: "combined", label: "POS transactions + ERP sales orders" }]} />
              </Field>
              <Field label="Frequency" htmlFor="freq">
                <Select
                  id="freq"
                  value={input.frequency}
                  onValueChange={(v) => set("frequency", v as RunInput["frequency"])}
                  options={[
                    { value: "daily", label: "Daily" },
                    { value: "weekly", label: "Weekly", description: "Only intermittent-demand models" },
                  ]}
                />
              </Field>
            </div>
            <Panel className="mt-5 shadow-none" bodyClassName="grid gap-4 sm:grid-cols-4">
              <Stat label="Historical window" value={`${historyDays} days`} />
              <Stat label="Data available through" value={formatDate(input.historicalEnd)} />
              <div>
                <p className="caption">Data freshness</p>
                <FreshnessIndicator timestamp={sources.data?.find((x) => x.id === "src_pos")?.lastSuccessAt} label="POS updated" source="POS transactions" />
              </div>
              <Stat
                label="Missing periods"
                value={dq.data ? (dq.data.page.total === 0 ? "None detected" : pluralize(dq.data.page.items.reduce((n, i) => n + i.affectedSkus, 0), "SKU") + " affected") : "…"}
                hint={dq.data?.page.items[0]?.title}
              />
            </Panel>
          </WizardPanel>
        )}

        {step === 2 && (
          <WizardPanel
            title="Configure horizon"
            description="How many days ahead to forecast. Longer horizons have wider prediction intervals."
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(2)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            <RadioCards
              aria-label="Forecast horizon"
              columns={3}
              value={RUN_FORM_OPTIONS.horizons.includes(input.horizonDays) ? String(input.horizonDays) : "custom"}
              onValueChange={(v) => v !== "custom" && set("horizonDays", Number(v))}
              options={[
                ...RUN_FORM_OPTIONS.horizons.map((h) => ({
                  value: String(h),
                  label: `${h} days`,
                  description: h <= 14 ? "Replenishment" : h <= 30 ? "Monthly planning" : "Seasonal build",
                })),
                { value: "custom", label: "Custom", description: "Enter a value below" },
              ]}
            />
            <Field className="mt-4 max-w-xs" label="Custom horizon (days)" htmlFor="h-custom" hint="1–180 days. Allowed values need confirmation (backlog §93 item 6).">
              <Input id="h-custom" type="number" min={1} max={180} value={input.horizonDays} onChange={(e) => set("horizonDays", Math.max(1, Math.min(180, Number(e.target.value) || 1)))} />
            </Field>
          </WizardPanel>
        )}

        {step === 3 && (
          <WizardPanel
            title="Select model"
            description="Compare models on historical performance, not a single score. Candidate models should be reviewed before publishing."
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(3)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            {models.isPending ? (
              <p className="caption">Loading models…</p>
            ) : models.isError ? (
              <ErrorState compact what="Models could not be loaded." error={models.error} onRetry={() => models.refetch()} />
            ) : (
              <RadioCards
                aria-label="Model"
                value={input.modelId}
                onValueChange={(v) => set("modelId", v)}
                options={(models.data ?? []).map((m: ForecastModel) => {
                  const incompatible = m.status === "archived" || m.horizonDays < input.horizonDays || m.frequency !== input.frequency;
                  return {
                    value: m.id,
                    disabled: m.status === "archived",
                    label: `${m.name} ${m.version}${m.isDefault ? " · Default" : ""}`,
                    meta: <StatusBadge status={m.status} size="sm" />,
                    description: (
                      <span className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-4">
                        <span>WAPE {formatPercent(m.metrics.wape)}</span>
                        <span>Bias {m.metrics.bias >= 0 ? "+" : "−"}{formatPercent(Math.abs(m.metrics.bias))}</span>
                        <span>Coverage {formatPercent(m.metrics.coverage80, 0)}</span>
                        <span>Trained {formatDate(m.lastTrainedAt)}</span>
                        {incompatible && m.status !== "archived" && (
                          <span className="col-span-full font-semibold text-warning-fg">
                            {m.frequency !== input.frequency ? `Supports ${m.frequency} forecasts only.` : `Supports horizons up to ${m.horizonDays} days.`}
                          </span>
                        )}
                      </span>
                    ),
                  };
                })}
              />
            )}
          </WizardPanel>
        )}

        {step === 4 && (
          <WizardPanel
            title="Validate data"
            description="Checks run against the selected scope, window and model. Blocking results must be resolved before running."
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={goNext} disabled={!stepValid(4)}>
                  {nextLabel}
                </Button>
              </>
            }
          >
            {validation.isPending ? (
              <p className="flex items-center gap-2 body-sm text-fg-secondary" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Running validation checks…
              </p>
            ) : validation.isError ? (
              <ErrorState compact what="Validation could not run." error={validation.error} onRetry={() => validation.refetch()} retryLabel="Retry validation" />
            ) : (
              <>
                {blocking.length > 0 ? (
                  <InlineAlert tone="critical" title={`${pluralize(blocking.length, "blocking issue")} must be resolved before running.`} className="mb-4">
                    Change the scope, window, horizon or model, or resolve the data issue first.
                  </InlineAlert>
                ) : (
                  <InlineAlert tone={warnings.length ? "warning" : "success"} title={warnings.length ? `Ready to run with ${pluralize(warnings.length, "warning")}.` : "All checks passed."} className="mb-4" />
                )}
                <ul className="divide-y divide-border-subtle rounded-lg border border-border">
                  {checks.map((c) => (
                    <CheckRow key={c.key} check={c} />
                  ))}
                </ul>
              </>
            )}
          </WizardPanel>
        )}

        {step === 5 && (
          <WizardPanel
            title="Review configuration"
            description="Check the configuration before starting. The run can be cancelled while it is processing."
            footer={
              <>
                <Button variant="ghost" onClick={goBack}>
                  {backLabel}
                </Button>
                <Button variant="primary" onClick={start} loading={create.isPending} loadingText="Starting forecast run" disabled={blocking.length > 0}>
                  <Play aria-hidden /> Run forecast
                </Button>
              </>
            }
          >
            <ConsequenceSummary rows={summaryRows} />
          </WizardPanel>
        )}
      </WizardLayout>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent
          title="Run this forecast?"
          description={`This run will generate forecasts for ${pluralize(scope.data?.skuCount ?? 0, "SKU")}.`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
                Back to configuration
              </Button>
              <Button variant="primary" loading={create.isPending} loadingText="Starting forecast run" onClick={() => create.mutate(input)}>
                <Play aria-hidden /> Run forecast
              </Button>
            </>
          }
        >
          <ConsequenceSummary
            rows={[
              { label: "SKUs", value: formatNumber(scope.data?.skuCount ?? 0), emphasis: true },
              { label: "Historical window", value: formatDateRange(input.historicalStart, input.historicalEnd) },
              { label: "Forecast horizon", value: `${input.horizonDays} days` },
              { label: "Model", value: selectedModel ? `${selectedModel.name} ${selectedModel.version}` : "—" },
              { label: "Warnings", value: warnings.length ? warnings.map((w) => w.detail).join(" ") : "None" },
              { label: "What happens next", value: "The run is queued, processed and saved as Completed. It does not replace the planning baseline until it is published." },
            ]}
          />
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="caption">{label}</p>
      <p className="body-sm font-semibold text-fg tabular">{value}</p>
      {hint && <p className="caption">{hint}</p>}
    </div>
  );
}

function CheckRow({ check }: { check: ValidationCheck }) {
  const icon =
    check.result === "pass" ? <CheckCircle2 className="size-4 text-success" aria-hidden /> : check.result === "warning" ? <AlertTriangle className="size-4 text-warning" aria-hidden /> : <AlertOctagon className="size-4 text-critical" aria-hidden />;
  const label = check.result === "pass" ? "Pass" : check.result === "warning" ? "Warning" : "Blocking";
  return (
    <li className="grid grid-cols-[1.25rem_minmax(8rem,12rem)_1fr_auto] items-start gap-3 px-4 py-3">
      <span className="mt-0.5">{icon}</span>
      <span className="body-sm font-semibold text-fg">{check.label}</span>
      <span className="body-sm text-fg-secondary">{check.detail}</span>
      <span className={cn("text-xs font-bold", check.result === "pass" ? "text-success-fg" : check.result === "warning" ? "text-warning-fg" : "text-critical-fg")}>{label}</span>
    </li>
  );
}
