"use client";

import { AlertTriangle, Ban, CheckCircle2, Circle, Copy, Loader2, RotateCcw, Send, SkipForward, Table2, XCircle } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ForecastRun, RunStep } from "@/types/domain";
import { getRun, getRunResult } from "@/lib/api/forecasting";
import { auditFor } from "@/lib/api/governance";
import { useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { actorName } from "@/lib/mock/directory";
import { runDurationMs, runProgress } from "@/lib/mock/runs";
import { formatDateRange, formatDateTime, formatDeltaPercent, formatDuration, formatNumber, pluralize } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { DescriptionList, MetaItem, PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { StatusBadge } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EmptyState, ErrorState, InlineAlert, PageSkeleton } from "@/components/feedback/states";
import { EntityId, ModelIdentity, ProductIdentity, scopeLabel } from "@/components/entities/identity";
import { ForecastDelta, MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { PairedBars } from "@/components/charts/small-charts";
import { AuditTimeline } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { useRunActions } from "./run-actions";

export function RunDetailView({ runId }: { runId: string }) {
  const { can } = useSession();
  useBreadcrumbLeaf(runId);
  const q = useApiQuery(["run", runId], (c) => getRun(c, runId), {
    refetchInterval: (query) => {
      const s = query.state.data?.run.status;
      return s === "queued" || s === "running" ? 2000 : false;
    },
  });
  const run = q.data?.run;
  const hasResults = run && (run.status === "completed" || run.status === "published" || run.status === "archived");
  const result = useApiQuery(["run-result", runId], (c) => getRunResult(c, runId), { enabled: !!hasResults });
  const events = useApiQuery(["run-audit", runId, run?.status], (c) => auditFor(c, [runId]), { enabled: !!run });
  const actions = useRunActions(null);

  const prevStatus = React.useRef(run?.status);
  React.useEffect(() => {
    if (prevStatus.current && prevStatus.current !== run?.status && run?.status === "completed") track("forecast_run_completed", {});
    prevStatus.current = run?.status;
  }, [run?.status]);

  if (q.isPending) {
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    );
  }
  if (q.isError || !run) {
    return (
      <PageContainer>
        <PageHeader title="Forecast run" />
        <Panel>
          <ErrorState
            what={`Forecast run ${runId} could not be loaded.`}
            error={q.error}
            onRetry={() => q.refetch()}
            recovery={
              <Link href="/forecasting/runs" className={buttonVariants({ variant: "secondary" })}>
                Back to forecast runs
              </Link>
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  const active = run.status === "queued" || run.status === "running";

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<EntityId value={run.id} />}
        title={run.name}
        meta={
          <>
            <StatusBadge status={run.status} />
            <MetaItem>{scopeLabel(run)}</MetaItem>
            <MetaItem>{pluralize(run.scope.skuCount, "SKU")} · {run.scope.locationCount} locations</MetaItem>
            <MetaItem>{run.horizonDays}-day horizon · model {run.modelVersion}</MetaItem>
            <MetaItem>Created by {actorName(run.createdBy)} · {formatDateTime(run.createdAt)}</MetaItem>
          </>
        }
        actions={
          <>
            {can("forecast.run.create") && run.status !== "draft" && (
              <Link href={`/forecasting/runs/new?from=${run.id}`} className={buttonVariants({ variant: "secondary" })}>
                <Copy aria-hidden /> Duplicate configuration
              </Link>
            )}
            {active && can("forecast.run.cancel") && (
              <Button variant="danger-outline" onClick={() => actions.open("cancel", run)}>
                <Ban aria-hidden /> Cancel run
              </Button>
            )}
            {(run.status === "failed" || run.status === "cancelled") && can("forecast.run.create") && (
              <Button variant="primary" loading={actions.retry.isPending} onClick={() => actions.retry.mutate(run.id)}>
                <RotateCcw aria-hidden /> Retry run
              </Button>
            )}
            {hasResults && (
              <Link href={`/forecasting/explorer?run=${run.id}`} className={buttonVariants({ variant: run.status === "completed" && can("forecast.run.publish") ? "secondary" : "primary" })}>
                <Table2 aria-hidden /> Explore results
              </Link>
            )}
            {run.status === "completed" && can("forecast.run.publish") && (
              <Button variant="primary" onClick={() => actions.open("publish", run)}>
                <Send aria-hidden /> Publish as baseline
              </Button>
            )}
          </>
        }
      />

      {run.status === "draft" && (
        <InlineAlert
          tone="info"
          title="This run is a draft and has not been started."
          action={
            can("forecast.run.create") ? (
              <Link href={`/forecasting/runs/new?from=${run.id}`} className={buttonVariants({ variant: "primary", size: "sm" })}>
                Continue configuring
              </Link>
            ) : undefined
          }
        >
          Drafts keep a saved configuration. Validate and run it to generate forecasts.
        </InlineAlert>
      )}
      {run.status === "completed" && (
        <InlineAlert tone="info" title="Results are ready but not published.">
          The planning baseline is still the last published run. Review the results, then publish if they are fit for planning.
          {!can("forecast.run.publish") && " Publishing needs a Manager or Administrator."}
        </InlineAlert>
      )}
      {run.status === "failed" && (
        <InlineAlert
          tone="critical"
          title={`Forecast run failed during ${run.steps.find((s) => s.status === "failed")?.label.toLowerCase() ?? "processing"}.`}
          action={
            <Link href="/demand-data/quality?severity=blocking" className={buttonVariants({ variant: "secondary", size: "sm" })}>
              View data issues
            </Link>
          }
        >
          {run.failureReason} The run was not published and no results were written. Resolve the data issue or change the historical window, then retry.
        </InlineAlert>
      )}
      {run.status === "cancelled" && (
        <InlineAlert tone="warning" title="This run was cancelled.">
          No results were written. Retry to process it again with the same configuration.
        </InlineAlert>
      )}

      {(active || run.status === "failed" || run.status === "cancelled") && <RunProgress run={run} />}

      {hasResults && (
        <>
          {result.isPending ? (
            <Panel>
              <p className="flex items-center gap-2 body-sm text-fg-secondary" role="status">
                <Loader2 className="size-4 animate-spin" aria-hidden /> Loading results…
              </p>
            </Panel>
          ) : result.isError ? (
            <Panel>
              <ErrorState what="Run results could not be loaded." error={result.error} onRetry={() => result.refetch()} />
            </Panel>
          ) : (
            <>
              <MetricStrip>
                <MetricCard
                  label={`Forecast · ${run.horizonDays} days`}
                  value={formatNumber(result.data.summary.forecastValue)}
                  unit="units"
                  delta={<ForecastDelta percent={result.data.summary.deltaPercent} size="sm" />}
                  context={`80% interval ${formatNumber(result.data.summary.lowerBound)} – ${formatNumber(result.data.summary.upperBound)}`}
                />
                <MetricCard label="Previous run" value={formatNumber(result.data.summary.previousForecast)} unit="units" context={`${formatDeltaPercent(result.data.summary.deltaPercent)} change`} />
                <MetricCard label={`Actual · last ${run.horizonDays} days`} value={formatNumber(result.data.summary.actualLastPeriod)} unit="units" context="Same length as the horizon" />
                <MetricCard
                  label="SKUs needing review"
                  value={formatNumber(result.data.counts.needsReview)}
                  context={`${result.data.counts.increases} up >5% · ${result.data.counts.decreases} down >5%`}
                  href={`/forecasting/explorer?run=${run.id}&status=needs_review`}
                  hrefLabel="Review in explorer"
                />
              </MetricStrip>
              <ForecastChart
                title="Scope forecast"
                points={result.data.points.slice(-(91 + run.horizonDays))}
                unit="units per day"
                source="POS transactions, ERP sales orders"
                asOf={run.dataAsOf}
                summary={`${run.id} expects ${formatNumber(result.data.summary.forecastValue)} units over ${run.horizonDays} days (80% interval ${formatNumber(result.data.summary.lowerBound)}–${formatNumber(result.data.summary.upperBound)}), ${formatDeltaPercent(result.data.summary.deltaPercent)} versus the previous run.`}
              />
              <div className="grid gap-4 xl:grid-cols-2">
                <ChartFrame
                  title="Forecast by category"
                  question="Where does this run differ from the previous run?"
                  unit="units"
                  timeframe={`${run.horizonDays}-day horizon`}
                  legend={
                    <>
                      <LegendItem color="var(--chart-previous)" label="Previous run" variant="bar" />
                      <LegendItem color="var(--chart-forecast)" label="This run" variant="bar" />
                    </>
                  }
                  chart={<PairedBars rows={result.data.byCategory.map((c) => ({ label: c.category, a: c.previous, b: c.forecast }))} aLabel="Previous run" bLabel="This run" />}
                  table={
                    <ChartDataTable
                      caption="Forecast by category"
                      columns={[
                        { key: "c", label: "Category" },
                        { key: "p", label: "Previous", numeric: true },
                        { key: "f", label: "This run", numeric: true },
                        { key: "d", label: "Change", numeric: true },
                      ]}
                      rows={result.data.byCategory.map((c) => ({ c: c.category, p: formatNumber(c.previous), f: formatNumber(c.forecast), d: formatDeltaPercent(c.previous ? (c.forecast - c.previous) / c.previous : 0) }))}
                    />
                  }
                />
                <Panel
                  title="Largest changes versus previous run"
                  flush
                  actions={
                    <Link href={`/forecasting/explorer?run=${run.id}&sort=delta&dir=desc`} className="text-xs font-semibold text-primary hover:underline">
                      Open in explorer
                    </Link>
                  }
                >
                  <ul>
                    {result.data.topMovers.map((r) => (
                      <li key={r.id} className="border-b border-border-subtle last:border-b-0">
                        <Link href={`/forecasting/detail/${r.productId}?run=${run.id}`} className="grid grid-cols-[minmax(0,1fr)_6rem_5.5rem] items-center gap-3 px-4 py-2.5 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none">
                          <ProductIdentity product={r.product} />
                          <span className="text-right text-[0.8125rem] tabular">{formatNumber(r.forecast)}</span>
                          <span className="text-right">
                            <ForecastDelta percent={r.deltaPercent} size="sm" />
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Panel>
              </div>
            </>
          )}
        </>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title="Configuration">
          <DescriptionList
            columns={2}
            items={[
              { label: "Business unit", value: run.scope.businessUnit },
              { label: "Scope", value: scopeLabel(run) },
              { label: "Historical window", value: formatDateRange(run.historicalStart, run.historicalEnd) },
              { label: "Horizon", value: `${run.horizonDays} days · ${run.frequency}` },
              { label: "Model", value: <ModelIdentity model={q.data.model} /> },
              { label: "Input data", value: <FreshnessIndicator timestamp={run.dataAsOf} label="Data as of" /> },
              { label: "Started", value: formatDateTime(run.startedAt) },
              { label: "Completed", value: formatDateTime(run.completedAt) },
              ...(run.publishedAt ? [{ label: "Published", value: formatDateTime(run.publishedAt) }] : []),
            ]}
          />
          {run.warnings.length > 0 && (
            <div className="mt-4">
              <p className="mb-1.5 metadata">Validation warnings</p>
              <ul className="flex flex-col gap-1.5">
                {run.warnings.map((w) => (
                  <li key={w} className="flex items-start gap-2 body-sm text-fg-secondary">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <Panel title="Run history">{events.data ? <AuditTimeline events={events.data} emptyText="No recorded events for this run." /> : <p className="caption">Loading…</p>}</Panel>
      </div>
      {actions.dialog}
      {!hasResults && !active && run.status !== "failed" && run.status !== "cancelled" && run.status !== "draft" && <EmptyState title="No results for this run." />}
    </PageContainer>
  );
}

/** PAGE-FORECAST-PROCESSING: step state comes from the job, never animated on its own. */
function RunProgress({ run }: { run: ForecastRun }) {
  const [now, setNow] = React.useState(() => Date.now());
  const active = run.status === "queued" || run.status === "running";
  React.useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [active]);
  const p = runProgress(run);
  const started = run.startedAt ? new Date(run.startedAt).getTime() : null;
  const elapsed = started && now > started ? (run.completedAt ? new Date(run.completedAt).getTime() : now) - started : 0;
  const expected = runDurationMs(run.scope.skuCount, run.horizonDays);
  return (
    <PageSection title={active ? "Processing" : "Processing steps"} description={active ? "Status is read from the forecasting job every 2 seconds. You can leave this page; you will be notified when it finishes." : undefined}>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel flush>
          <ol aria-label="Run steps">
            {run.steps.map((s, i) => (
              <StepRow key={s.key} step={s} index={i} now={now} />
            ))}
          </ol>
        </Panel>
        <Panel title="Job">
          <DescriptionList
            items={[
              { label: "Steps completed", value: `${p.done} of ${p.total}` },
              { label: "Current step", value: p.current?.label ?? (run.status === "queued" ? "Waiting for a worker" : "—") },
              { label: "Elapsed", value: started ? formatDuration(elapsed) : "Not started" },
              { label: "Typical duration", value: `About ${formatDuration(expected)} for ${formatNumber(run.scope.skuCount)} SKUs` },
              { label: "Series", value: formatNumber(run.scope.skuCount * run.scope.locationCount) },
            ]}
          />
        </Panel>
      </div>
    </PageSection>
  );
}

function StepRow({ step, index, now }: { step: RunStep; index: number; now: number }) {
  const icon =
    step.status === "completed" ? (
      <CheckCircle2 className="size-5 text-success" aria-hidden />
    ) : step.status === "running" ? (
      <Loader2 className="size-5 animate-spin text-info" aria-hidden />
    ) : step.status === "failed" ? (
      <XCircle className="size-5 text-critical" aria-hidden />
    ) : step.status === "skipped" ? (
      <SkipForward className="size-5 text-fg-tertiary" aria-hidden />
    ) : (
      <Circle className="size-5 text-border-strong" aria-hidden />
    );
  const duration = step.startedAt ? (step.completedAt ? new Date(step.completedAt).getTime() : now) - new Date(step.startedAt).getTime() : null;
  return (
    <li className={cn("grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-start gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0", step.status === "running" && "bg-info-subtle/40")} aria-current={step.status === "running" ? "step" : undefined}>
      <span className="mt-0.5">{icon}</span>
      <span className="min-w-0">
        <span className="block body-sm font-semibold text-fg">
          {index + 1}. {step.label}
          <span className="sr-only"> — {step.status}</span>
        </span>
        {step.detail && <span className={cn("block caption", step.status === "failed" && "font-semibold text-critical-fg")}>{step.detail}</span>}
      </span>
      <span className="text-right text-xs tabular text-fg-tertiary">
        {step.startedAt ? formatDateTime(step.startedAt).split(", ")[1] : "—"}
        {duration !== null && duration > 0 && <span className="block">{formatDuration(duration)}</span>}
      </span>
    </li>
  );
}

