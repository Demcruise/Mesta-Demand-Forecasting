"use client";

import { ArrowDownRight, ArrowUpRight, GitBranch, Minus, Pencil } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import * as React from "react";
import { getForecastDetail } from "@/lib/api/forecasting";
import { useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { actorName } from "@/lib/mock/directory";
import { formatDate, formatDateRange, formatDateTime, formatDeltaNumber, formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { DescriptionList, MetaItem, PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { SeverityBadge, StatusBadge } from "@/components/feedback/status";
import { FreshnessIndicator } from "@/components/feedback/freshness";
import { EntityId, ModelIdentity } from "@/components/entities/identity";
import { ForecastDelta, ForecastInterval, MetricCard, MetricStrip } from "@/components/forecasting/metrics";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { AuditTimeline } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { OVERRIDE_REASONS, OverrideDialog } from "./override-dialog";

/** PAGE-FORECAST-DETAIL: explain one forecasted entity. */
export function ForecastDetailView({ productId }: { productId: string }) {
  const params = useSearchParams();
  const runId = params.get("run");
  const { can } = useSession();
  const [overrideOpen, setOverrideOpen] = React.useState(false);
  const q = useApiQuery(["forecast-detail", productId, runId], (c) => getForecastDetail(c, productId, runId));
  useBreadcrumbLeaf(q.data?.product.name ?? null);

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
        <PageHeader title="Forecast detail" />
        <Panel>
          <ErrorState
            what="This forecast could not be loaded."
            error={q.error}
            onRetry={() => q.refetch()}
            recovery={
              <Link href="/forecasting/explorer" className={buttonVariants({ variant: "secondary" })}>
                Back to forecast explorer
              </Link>
            }
          />
        </Panel>
      </PageContainer>
    );
  }
  const d = q.data;
  const s = d.summary;
  const width = s.forecastValue > 0 ? (s.upperBound - s.lowerBound) / s.forecastValue : 0;
  const vsActual = s.actualLastPeriod > 0 ? (s.forecastValue - s.actualLastPeriod) / s.actualLastPeriod : 0;
  const openEx = d.exceptions.filter((e) => e.status === "open" || e.status === "investigating" || e.status === "escalated");
  const pointsWindow = d.points.slice(-(119 + s.horizonDays));

  return (
    <PageContainer>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5 normal-case tracking-normal">
            {d.product.category} · <span className="mono-id">{d.product.sku}</span>
          </span>
        }
        title={d.product.name}
        meta={
          <>
            {d.row && <StatusBadge status={d.row.status} />}
            <MetaItem>
              Run <Link href={`/forecasting/runs/${d.run.id}`} className="mono-id text-primary hover:underline">{d.run.id}</Link>
              {d.run.status !== "published" && " (not published)"}
            </MetaItem>
            <MetaItem>Forecast period {formatDateRange(s.periodStart, s.periodEnd)}</MetaItem>
            <MetaItem>Lifecycle: {d.product.lifecycle}</MetaItem>
            <FreshnessIndicator timestamp={d.run.dataAsOf} label="Input data as of" />
          </>
        }
        actions={
          <>
            <Link href={`/forecasting/lineage?product=${d.product.id}`} className={buttonVariants({ variant: "secondary" })}>
              <GitBranch aria-hidden /> Decision lineage
            </Link>
            {can("forecast.override") && d.run.status === "published" && (
              <Button variant="primary" onClick={() => setOverrideOpen(true)}>
                <Pencil aria-hidden /> Override forecast
              </Button>
            )}
          </>
        }
      />

      <PageSection title="Forecast summary" id="summary">
        <MetricStrip>
          <MetricCard
            label={`Expected demand · ${s.horizonDays} days`}
            value={formatNumber(s.forecastValue)}
            unit={d.product.unit}
            context={`${formatNumber(Math.round(s.forecastValue / s.horizonDays))} per day on average`}
          />
          <MetricCard label="Change vs previous run" value={formatDeltaPercent(s.deltaPercent)} delta={<ForecastDelta percent={s.deltaPercent} size="sm" />} context={`${formatDeltaNumber(s.delta)} ${d.product.unit} (previous ${formatNumber(s.previousForecast)})`} />
          <MetricCard label="Change vs recent actuals" value={formatDeltaPercent(vsActual)} context={`Actual demand in the ${s.horizonDays} days before: ${formatNumber(s.actualLastPeriod)}`} />
          <MetricCard
            label="Override"
            value={d.row?.overrideUnits != null ? formatNumber(d.row.overrideUnits) : "None"}
            unit={d.row?.overrideUnits != null ? d.product.unit : undefined}
            context={
              d.overrides.find((o) => o.status === "pending_approval")
                ? "An override is waiting for approval."
                : d.row?.overrideUnits != null
                  ? "Applied to the planning baseline."
                  : "The model forecast is used for planning."
            }
          />
        </MetricStrip>
      </PageSection>

      <ForecastChart
        title="Historical demand and forecast"
        points={pointsWindow}
        unit={`${d.product.unit} per day`}
        source="POS transactions, ERP sales orders"
        asOf={d.run.dataAsOf}
        summary={`Forecast period ${formatDateRange(s.periodStart, s.periodEnd)}. Expected demand ${formatNumber(s.forecastValue)} ${d.product.unit}; range ${formatNumber(s.lowerBound)} – ${formatNumber(s.upperBound)} ${d.product.unit}.`}
        height={320}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Forecast uncertainty" description="How wide the plausible range is, and how this run compares with the previous one.">
          <DescriptionList
            columns={3}
            items={[
              { label: "Expected demand", value: <span className="numeric-md">{formatNumber(s.forecastValue)}</span> },
              { label: "Prediction interval", value: <span className="tabular">{formatNumber(s.lowerBound)} – {formatNumber(s.upperBound)}</span> },
              { label: "Coverage", value: formatPercent(s.coverage, 0), hint: "Share of outcomes expected inside the interval" },
            ]}
          />
          <ForecastInterval className="mt-5" lower={s.lowerBound} upper={s.upperBound} forecast={s.forecastValue} comparison={s.previousForecast} override={d.row?.overrideUnits} unit={d.product.unit} coverage={s.coverage} />
          <p className="mt-4 body-sm text-fg-secondary">
            In 8 out of 10 comparable periods, actual demand fell between {formatNumber(s.lowerBound)} and {formatNumber(s.upperBound)} {d.product.unit}. The range is {formatPercent(width, 0)} of the forecast
            {width > 0.9 ? ", which is wide: treat the point forecast with caution." : "."} Interval definitions must be confirmed with the analytics owners (backlog §93 item 11).
          </p>
        </Panel>
        <Panel title="Drivers and assumptions" description="What the model used and what it may be missing.">
          <ul className="flex flex-col gap-3">
            {d.signals.map((sig) => {
              const Icon = sig.effect === "up" ? ArrowUpRight : sig.effect === "down" ? ArrowDownRight : Minus;
              return (
                <li key={sig.label} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border", sig.effect === "neutral" ? "border-border bg-subtle text-fg-tertiary" : "border-border bg-subtle text-fg-secondary")}>
                    <Icon className="size-3.5" aria-label={sig.effect === "up" ? "Raises demand" : sig.effect === "down" ? "Lowers demand" : "Shapes demand"} />
                  </span>
                  <span className="body-sm">
                    <span className="font-semibold text-fg">{sig.label}.</span> <span className="text-fg-secondary">{sig.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>
          {d.scenarios.length > 0 && (
            <div className="mt-4 border-t border-border-subtle pt-3">
              <p className="mb-1.5 metadata">Scenarios covering this category</p>
              <ul className="flex flex-col gap-1">
                {d.scenarios.map((sc) => (
                  <li key={sc.id} className="flex items-center justify-between gap-2">
                    <Link href={`/scenarios/${sc.id}`} className="truncate body-sm font-semibold text-primary hover:underline">
                      {sc.name}
                    </Link>
                    <StatusBadge status={sc.status} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Model information">
          <div className="flex flex-col gap-4">
            <ModelIdentity model={d.model} showStatus />
            {d.model && (
              <DescriptionList
                columns={2}
                items={[
                  { label: "Version", value: d.model.version },
                  { label: "Last trained", value: formatDate(d.model.lastTrainedAt) },
                  { label: "Training period", value: formatDateRange(d.model.trainingStart, d.model.trainingEnd) },
                  { label: "Portfolio WAPE", value: formatPercent(d.model.metrics.wape), hint: `${formatDate(d.model.metrics.evaluationStart)} – ${formatDate(d.model.metrics.evaluationEnd)}` },
                ]}
              />
            )}
            {d.model && d.model.limitations.length > 0 && (
              <div>
                <p className="mb-1 metadata">Known limitations</p>
                <ul className="list-disc pl-5 body-sm text-fg-secondary">
                  {d.model.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Panel>
        <Panel
          title={`Exceptions (${openEx.length} open)`}
          flush
          actions={
            <Link href={`/planning/exceptions?q=${encodeURIComponent(d.product.sku)}`} className="text-xs font-semibold text-primary hover:underline">
              View in exceptions
            </Link>
          }
        >
          {d.exceptions.length === 0 ? (
            <p className="px-4 py-6 caption">No exceptions have been raised for this product.</p>
          ) : (
            <ul>
              {d.exceptions.map((e) => (
                <li key={e.id} className="border-b border-border-subtle last:border-b-0">
                  <Link href={`/planning/exceptions?id=${e.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 hover:bg-hover">
                    <SeverityBadge severity={e.severity} size="sm" />
                    <span className="min-w-0 body-sm text-fg-secondary">
                      <span className="mono-id mr-1.5 text-fg">{e.id}</span>
                      {e.reason}
                    </span>
                    <StatusBadge status={e.status} size="sm" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Overrides" description="Every manual change, who made it and why.">
          {d.overrides.length === 0 ? (
            <p className="caption">No overrides have been applied to this product.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {d.overrides.map((o) => (
                <li key={o.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="body-sm font-semibold">
                      {formatNumber(o.originalUnits)} → {formatNumber(o.newUnits)} units ({formatDeltaPercent((o.newUnits - o.originalUnits) / o.originalUnits)})
                    </span>
                    <StatusBadge status={o.status === "applied" ? "approved" : o.status === "pending_approval" ? "pending" : "rejected"} label={o.status === "applied" ? "Applied" : o.status === "pending_approval" ? "Pending approval" : "Rejected"} size="sm" />
                  </div>
                  <p className="mt-1 caption">
                    {OVERRIDE_REASONS.find((r) => r.value === o.reason)?.label} · {o.productIds.length > 1 ? `part of a ${o.productIds.length}-SKU override` : "this SKU only"}
                  </p>
                  <p className="mt-1 body-sm text-fg-secondary">“{o.comment}”</p>
                  <p className="mt-1 text-[0.6875rem] text-fg-tertiary">
                    {actorName(o.userId)} · {formatDateTime(o.createdAt)} · <EntityId value={o.id} copy={false} />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="Audit history">
          <AuditTimeline events={d.audit} emptyText="No audited changes for this product yet." />
        </Panel>
      </div>

      <OverrideDialog open={overrideOpen} onOpenChange={setOverrideOpen} runId={d.run.id} productIds={[d.product.id]} originalUnits={s.forecastValue} label={d.product.name} horizonDays={s.horizonDays} />
    </PageContainer>
  );
}
