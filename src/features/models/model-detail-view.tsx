"use client";

import { Archive, FlaskConical, Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ModelMetrics } from "@/types/domain";
import { archiveModel, getModel, requestDefaultModel } from "@/lib/api/models";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDate, formatDateRange, formatDateTime, formatDecimal, formatDeltaPercent, formatNumber, formatPercent } from "@/lib/format";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { DescriptionList, MetaItem, PageContainer, PageHeader, Panel } from "@/components/page/page";
import { StatusBadge, Tag } from "@/components/feedback/status";
import { ErrorState, InlineAlert, PageSkeleton } from "@/components/feedback/states";
import { EntityId, RunIdentity, UserIdentity } from "@/components/entities/identity";
import { ForecastChart } from "@/components/charts/forecast-chart";
import { ChartDataTable } from "@/components/charts/chart-frame";
import { AuditTimeline, ConsequenceSummary } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { METRIC_DEFINITIONS, type MetricKey } from "./metric-definitions";

export function metricValue(m: ModelMetrics, key: MetricKey) {
  switch (key) {
    case "wape":
      return formatPercent(m.wape);
    case "bias":
      return formatDeltaPercent(m.bias);
    case "mae":
      return formatDecimal(m.mae);
    case "rmse":
      return formatDecimal(m.rmse);
    case "coverage":
      return formatPercent(m.coverage80, 0);
  }
}

/** Metric table: definition, unit, period, population and baseline for every metric. */
export function MetricTable({ metrics }: { metrics: ModelMetrics }) {
  return (
    <ChartDataTable
      caption="Model performance metrics"
      maxHeight="none"
      columns={[
        { key: "metric", label: "Metric" },
        { key: "value", label: "Value", numeric: true },
        { key: "definition", label: "Definition" },
        { key: "baseline", label: "Comparison baseline" },
      ]}
      rows={(Object.keys(METRIC_DEFINITIONS) as MetricKey[]).map((k) => ({
        metric: (
          <span className="flex flex-col">
            <span>{METRIC_DEFINITIONS[k].label}</span>
            <span className="text-[0.6875rem] font-normal text-fg-tertiary">{METRIC_DEFINITIONS[k].unit}</span>
          </span>
        ),
        value: <span className="font-semibold">{metricValue(metrics, k)}</span>,
        definition: <span className="whitespace-normal text-fg-secondary">{METRIC_DEFINITIONS[k].definition}</span>,
        baseline: <span className="whitespace-normal text-fg-secondary">{METRIC_DEFINITIONS[k].baseline}</span>,
      }))}
    />
  );
}

/** PAGE-MODEL-DETAIL */
export function ModelDetailView({ modelId }: { modelId: string }) {
  const { can } = useSession();
  const q = useApiQuery(["model", modelId], (c) => getModel(c, modelId));
  useBreadcrumbLeaf(q.data ? `${q.data.model.name} ${q.data.model.version}` : null);
  const [dialog, setDialog] = React.useState<null | "default" | "archive">(null);
  const [rationale, setRationale] = React.useState("");
  const promote = useApiMutation((c, v: string) => requestDefaultModel(c, modelId, v), {
    invalidate: [["model"], ["approvals"], ["nav-counts"]],
    success: "Promotion requested",
    successDescription: "A Manager must approve before new runs use this model by default.",
    failure: "The request was not created.",
    onSuccess: () => setDialog(null),
  });
  const archive = useApiMutation((c, _v: void) => archiveModel(c, modelId), { invalidate: [["model"], ["models"]], success: "Model archived", failure: "The model was not archived.", onSuccess: () => setDialog(null) });

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Model" />
        <Panel>
          <ErrorState what="This model could not be loaded." error={q.error} onRetry={() => q.refetch()} recovery={<Link href="/models" className={buttonVariants({ variant: "secondary" })}>Back to model registry</Link>} />
        </Panel>
      </PageContainer>
    );
  }
  const { model: m, backtests, runs, audit, pendingApproval } = q.data;
  const latest = backtests.find((b) => b.status === "completed");

  return (
    <PageContainer>
      <PageHeader
        eyebrow={<EntityId value={m.id} />}
        title={`${m.name} ${m.version}`}
        description={m.family}
        meta={
          <>
            <StatusBadge status={m.status} />
            {m.isDefault && <Tag tone="primary">Default model</Tag>}
            <MetaItem>Last trained {formatDateTime(m.lastTrainedAt)}</MetaItem>
            <MetaItem>
              Owner <UserIdentity userId={m.owner} className="ml-1" />
            </MetaItem>
          </>
        }
        actions={
          <>
            {can("backtest.run") && (
              <Link href={`/models/backtesting?model=${m.id}`} className={buttonVariants({ variant: "secondary" })}>
                <FlaskConical aria-hidden /> Run backtest
              </Link>
            )}
            {can("model.manage") && !m.isDefault && m.status !== "archived" && (
              <Button variant="secondary" onClick={() => setDialog("archive")}>
                <Archive aria-hidden /> Archive
              </Button>
            )}
            {can("model.manage") && !m.isDefault && m.status !== "archived" && (
              <Button variant="primary" onClick={() => { setRationale(""); setDialog("default"); }} disabled={!!pendingApproval}>
                <Star aria-hidden /> Request as default
              </Button>
            )}
          </>
        }
      />
      {pendingApproval && (
        <InlineAlert tone="info" title="A request to make this model the default is waiting for approval." action={<Link href={`/planning/approvals?id=${pendingApproval.id}`} className={buttonVariants({ size: "sm" })}>View request</Link>}>
          Requested {formatDateTime(pendingApproval.requestedAt)}.
        </InlineAlert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Performance" description={`Latest evaluation ${formatDateRange(m.metrics.evaluationStart, m.metrics.evaluationEnd)} · ${m.metrics.population}`}>
          <MetricTable metrics={m.metrics} />
        </Panel>
        <Panel title="Version metadata">
          <DescriptionList
            items={[
              { label: "Version", value: m.version },
              { label: "Training period", value: formatDateRange(m.trainingStart, m.trainingEnd) },
              { label: "Dataset", value: m.dataset },
              { label: "Forecast horizon", value: `Up to ${m.horizonDays} days` },
              { label: "Frequency", value: m.frequency === "daily" ? "Daily" : "Weekly" },
            ]}
          />
          <div className="mt-4">
            <p className="mb-1.5 metadata">Features</p>
            <div className="flex flex-wrap gap-1.5">
              {m.features.map((f) => (
                <Tag key={f}>{f}</Tag>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {latest ? (
        <ForecastChart
          title={`Backtest ${latest.id}: forecast vs actual`}
          question="How closely did this model's forecasts track actual demand in the past?"
          points={latest.points}
          unit="units per day"
          source={`Backtest ${latest.id}`}
          summary={`Over ${formatDateRange(latest.windowStart, latest.windowEnd)}, WAPE was ${formatPercent(latest.metrics?.wape ?? 0)} and ${formatPercent(latest.metrics?.coverage80 ?? 0, 0)} of days fell inside the 80% interval.`}
          height={260}
        />
      ) : (
        <Panel title="Backtesting">
          <p className="caption">No completed backtest for this model yet.</p>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Known limitations">
          <ul className="list-disc pl-5 body-sm text-fg-secondary">
            {m.limitations.map((l) => (
              <li key={l} className="mb-1">
                {l}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Usage" description={`${formatNumber(m.usage.runs)} forecast runs · last used ${formatDate(m.usage.lastUsedAt)}`} flush>
          {runs.length === 0 ? (
            <p className="px-4 py-6 caption">No runs in this workspace used this model.</p>
          ) : (
            <ul>
              {runs.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-2.5 last:border-b-0">
                  <RunIdentity run={r} />
                  <StatusBadge status={r.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Panel title="Audit">
        <AuditTimeline events={audit} emptyText="No audited changes to this model." />
      </Panel>

      <Dialog open={dialog === "default"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          title={`Request ${m.name} ${m.version} as the default model?`}
          description="Model promotion always goes through Manager approval."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button variant="primary" disabled={rationale.trim().length < 10} loading={promote.isPending} onClick={() => promote.mutate(rationale)}>
                Submit for approval
              </Button>
            </>
          }
        >
          <ConsequenceSummary
            rows={[
              { label: "What changes", value: "New forecast runs use this model unless another is chosen." },
              { label: "What does not change", value: "Existing runs, the current baseline and open plans." },
              { label: "Evidence attached", value: backtests.length ? backtests.map((b) => b.id).join(", ") : "No backtests. Run one first." },
              { label: "Approval", value: "Manager" },
            ]}
          />
          <Field className="mt-4" label="Rationale" htmlFor="promo-why" required hint="At least 10 characters. Recorded with the request.">
            <Textarea id="promo-why" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="e.g. Lower WAPE and better-calibrated intervals over the last 90 days." />
          </Field>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "archive"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          size="sm"
          title={`Archive ${m.name} ${m.version}?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Cancel
              </Button>
              <Button variant="primary" loading={archive.isPending} onClick={() => archive.mutate()}>
                Archive model
              </Button>
            </>
          }
        >
          <p className="body-sm text-fg-secondary">Archived models cannot be selected for new forecast runs. Existing runs and backtests keep their reference to this model.</p>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
