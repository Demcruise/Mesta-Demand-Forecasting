"use client";

import { AlertOctagon, AlertTriangle, ArrowRight, Info, Plus } from "lucide-react";
import Link from "next/link";
import { getOverview } from "@/lib/api/governance";
import { useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDate, formatDateRange, formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { addDays } from "@/lib/mock/time";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { MetaItem, PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { ForecastDelta, MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { PairedBars } from "@/components/charts/small-charts";
import { StatusBadge, SeverityBadge } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/feedback/states";
import { ModelIdentity, ProductIdentity, RunIdentity, scopeLabel } from "@/components/entities/identity";
import { AuditTimeline } from "@/components/governance/audit";

/**
 * PAGE-OVERVIEW: understand the current forecast state within 5 seconds.
 *   Header → scope/date context → needs attention → forecast health → demand outlook
 *   → accuracy → exception queue → recent runs → activity
 */
export function OverviewView() {
  const { workspace, can } = useSession();
  const q = useApiQuery(["overview"], getOverview, { refetchInterval: 30_000 });

  if (q.isPending) {
    return (
      <PageContainer>
        <PageSkeleton />
      </PageContainer>
    );
  }
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Overview" />
        <Panel>
          <ErrorState what="The overview could not be loaded." error={q.error} onRetry={() => q.refetch()} retryLabel="Retry loading overview" />
        </Panel>
      </PageContainer>
    );
  }
  const d = q.data;
  const base = d.baseline;
  const pos = d.dataHealth.sources.find((s) => s.id === "src_pos");

  if (!base || !d.summary) {
    return (
      <PageContainer>
        <PageHeader title="Overview" description={`${workspace.name} · ${workspace.environment}`} />
        <Panel>
          <EmptyState
            title="No forecast has been published in this workspace yet."
            description="The overview summarises the latest published forecast run. Create and publish a run to see the demand outlook."
            action={
              can("forecast.run.create") ? (
                <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "primary" })}>
                  <Plus aria-hidden /> Create forecast run
                </Link>
              ) : undefined
            }
          />
        </Panel>
      </PageContainer>
    );
  }

  const periodStart = new Date(base.completedAt ?? base.createdAt).setHours(0, 0, 0, 0);
  const periodEnd = addDays(periodStart, base.horizonDays - 1);
  const s = d.summary;

  return (
    <PageContainer>
      <PageHeader
        title="Overview"
        description="Current demand outlook, forecast reliability and what needs your attention."
        actions={
          can("forecast.run.create") ? (
            <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "primary" })}>
              <Plus aria-hidden /> Create forecast run
            </Link>
          ) : undefined
        }
        meta={
          <>
            <MetaItem>
              Scope: {scopeLabel(base)} · {formatNumber(base.scope.skuCount)} SKUs · {base.scope.locationCount} locations
            </MetaItem>
            <MetaItem>Forecast period: {formatDateRange(new Date(periodStart), new Date(periodEnd))} ({base.horizonDays} days)</MetaItem>
            <MetaItem>
              Baseline:{" "}
              <Link href={`/forecasting/runs/${base.id}`} className="mono-id text-primary hover:underline">
                {base.id}
              </Link>
            </MetaItem>
            <FreshnessIndicator timestamp={pos?.lastSuccessAt} label="POS data updated" source="POS transactions" />
          </>
        }
      />

      {/* Needs attention */}
      <PageSection title="Needs attention" description="Ordered by severity. Each item links to where you can act on it." id="attention">
        {d.attention.length === 0 ? (
          <Panel>
            <EmptyState compact title="Nothing needs your attention right now." description="No blocking data issues, critical exceptions, failed runs or pending approvals." />
          </Panel>
        ) : (
          <ul className="grid auto-rows-fr gap-3 md:grid-cols-2 xl:grid-cols-3">
            {d.attention.map((a) => {
              const Icon = a.severity === "critical" ? AlertOctagon : a.severity === "warning" ? AlertTriangle : Info;
              return (
                <li key={a.id}>
                  <Link
                    href={a.href}
                    className={cn(
                      "group flex h-full flex-col rounded-lg border bg-surface p-4 shadow-sm transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      a.severity === "critical" ? "border-critical/30" : "border-border",
                    )}
                  >
                    <span className="flex items-start gap-2.5">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", a.severity === "critical" ? "text-critical" : a.severity === "warning" ? "text-warning" : "text-info")} aria-hidden />
                      <span className="min-w-0">
                        <span className="sr-only">{a.severity}: </span>
                        <span className="block body-sm font-semibold text-fg">{a.title}</span>
                        <span className="mt-0.5 line-clamp-2 block caption">{a.detail}</span>
                      </span>
                    </span>
                    <span className="mt-auto inline-flex items-center gap-1 pl-6 pt-3 text-xs font-semibold text-primary group-hover:underline">
                      {a.cta} <ArrowRight className="size-3.5" aria-hidden />
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </PageSection>

      {/* Forecast health */}
      <PageSection title="Forecast health" description={`From the published baseline ${base.id}, ${base.horizonDays}-day horizon.`} id="health">
        <MetricStrip>
          <MetricCard
            label={`Forecasted demand · next ${base.horizonDays} days`}
            value={formatNumber(s.forecast)}
            unit="units"
            delta={<ForecastDelta percent={s.deltaPercent} size="sm" />}
            context={`80% interval ${formatNumber(s.lower)} – ${formatNumber(s.upper)} · ${formatDeltaPercent(s.deltaPercent)} vs previous run`}
            href="/forecasting/explorer"
            hrefLabel="Open forecast explorer"
            tooltip="Sum of daily forecasts for all SKUs in scope over the horizon. The interval combines SKU-level intervals."
          />
          <MetricCard
            label="Forecast accuracy (WAPE)"
            value={d.accuracy ? formatPercent(d.accuracy.wape) : "—"}
            context={
              d.accuracyWindow
                ? `Backtest ${d.accuracyWindow.id}, ${formatDate(d.accuracyWindow.start)} – ${formatDate(d.accuracyWindow.end)}. Lower is better.`
                : "No backtest available for this model."
            }
            href="/models/performance"
            hrefLabel="View model performance"
            tooltip="Weighted absolute percentage error: total absolute error divided by total actual demand."
          />
          <MetricCard
            label="Forecast bias"
            value={d.accuracy ? formatDeltaPercent(d.accuracy.bias) : "—"}
            context="Positive means the model over-forecasts on average. Target within ±3%."
            href="/models/performance"
            hrefLabel="View bias by category"
            tooltip="Mean signed error divided by mean actual demand over the backtest window."
          />
          <MetricCard
            label="Open exceptions"
            value={formatNumber(d.exceptions.open)}
            context={`${d.exceptions.critical} critical · ${d.exceptions.warning} warning`}
            href="/planning/exceptions?status=open,investigating,escalated"
            hrefLabel="Review exceptions"
          />
        </MetricStrip>
      </PageSection>

      {/* Demand outlook */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ForecastChart
          title="Demand outlook"
          points={d.points}
          unit="units per day"
          source="POS transactions, ERP sales orders"
          asOf={base.dataAsOf}
          summary={`Expected demand over the next ${base.horizonDays} days is ${formatNumber(s.forecast)} units (80% interval ${formatNumber(s.lower)}–${formatNumber(s.upper)}), ${formatDeltaPercent(s.vsActualPercent)} versus actual demand in the previous ${base.horizonDays} days.`}
          height={300}
        />
        <ChartFrame
          title="Outlook by category"
          question="Which categories drive the change versus the previous run?"
          unit="units"
          timeframe={`Next ${base.horizonDays} days`}
          legend={
            <>
              <LegendItem color="var(--chart-previous)" label="Previous run" variant="bar" />
              <LegendItem color="var(--chart-forecast)" label="Current forecast" variant="bar" />
            </>
          }
          chart={<PairedBars rows={d.byCategory.map((c) => ({ label: c.category, a: c.previous, b: c.forecast }))} aLabel="Previous run" bLabel="Current forecast" />}
          table={
            <ChartDataTable
              caption="Forecast by category"
              columns={[
                { key: "c", label: "Category" },
                { key: "p", label: "Previous", numeric: true },
                { key: "f", label: "Forecast", numeric: true },
                { key: "d", label: "Change", numeric: true },
              ]}
              rows={d.byCategory.map((c) => ({ c: c.category, p: formatNumber(c.previous), f: formatNumber(c.forecast), d: formatDeltaPercent(c.previous ? (c.forecast - c.previous) / c.previous : 0) }))}
            />
          }
        />
      </div>

      {/* Exception queue + runs */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Largest forecast changes to review"
          description="Open exceptions with the biggest change versus the previous run."
          flush
          actions={
            <Link href="/planning/exceptions" className="text-xs font-semibold text-primary hover:underline">
              All exceptions
            </Link>
          }
        >
          {d.exceptions.top.length === 0 ? (
            <EmptyState compact title="No large changes need review." description="All forecast changes are within the review threshold." />
          ) : (
            <ul>
              {d.exceptions.top.map((e) => (
                <li key={e.id} className="border-b border-border-subtle last:border-b-0">
                  <Link href={`/planning/exceptions?id=${e.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none">
                    <ProductIdentity product={e.product} />
                    <SeverityBadge severity={e.severity} size="sm" />
                    <span className="w-20 text-right">
                      {e.valueUnit === "%" && e.type === "large_delta" ? <ForecastDelta percent={e.value} size="sm" /> : <span className="text-xs text-fg-secondary">{e.type.replace("_", " ")}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Recent forecast runs"
          flush
          actions={
            <Link href="/forecasting/runs" className="text-xs font-semibold text-primary hover:underline">
              All runs
            </Link>
          }
        >
          <ul>
            {d.runs.recent.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border-subtle px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <RunIdentity run={r} />
                <span className="hidden truncate text-xs text-fg-secondary sm:block">{scopeLabel(r)}</span>
                <StatusBadge status={r.status} size="sm" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Panel title="Model in use">
          <div className="flex flex-col gap-3">
            <ModelIdentity model={d.model} showStatus />
            <p className="caption">
              Produced {base.id}. Last trained {d.model ? formatDate(d.model.lastTrainedAt) : "—"}. {d.model?.limitations[0]}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={d.model ? `/models/${d.model.id}` : "/models"} className={buttonVariants({ size: "sm" })}>
                View model details
              </Link>
              <Link href="/forecasting/lineage" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                Trace decision lineage
              </Link>
            </div>
          </div>
        </Panel>
        <Panel
          title="Recent activity"
          actions={
            can("audit.view") ? (
              <Link href="/administration/audit" className="text-xs font-semibold text-primary hover:underline">
                Audit log
              </Link>
            ) : undefined
          }
        >
          <AuditTimeline events={d.activity.slice(0, 5)} />
        </Panel>
      </div>
    </PageContainer>
  );
}
