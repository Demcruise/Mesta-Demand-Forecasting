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

const LIFECYCLE_LABELS: Record<string, string> = { new: "Baru", core: "Inti", seasonal: "Musiman", "end-of-life": "Akhir masa" };

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
        <PageHeader title="Detail Perkiraan" />
        <Panel>
          <ErrorState
            what="Perkiraan ini tidak dapat dimuat."
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
              Proses <Link href={`/forecasting/runs/${d.run.id}`} className="mono-id text-primary hover:underline">{d.run.id}</Link>
              {d.run.status !== "published" && " (belum diterbitkan)"}
            </MetaItem>
            <MetaItem>Periode perkiraan {formatDateRange(s.periodStart, s.periodEnd)}</MetaItem>
            <MetaItem>Siklus produk: {LIFECYCLE_LABELS[d.product.lifecycle] ?? d.product.lifecycle}</MetaItem>
            <FreshnessIndicator timestamp={d.run.dataAsOf} label="Data masukan per" />
          </>
        }
        actions={
          <>
            <Link href={`/forecasting/lineage?product=${d.product.id}`} className={buttonVariants({ variant: "secondary" })}>
              <GitBranch aria-hidden /> Sumber keputusan
            </Link>
            {can("forecast.override") && d.run.status === "published" && (
              <Button variant="primary" onClick={() => setOverrideOpen(true)}>
                <Pencil aria-hidden /> Ubah Perkiraan
              </Button>
            )}
          </>
        }
      />

      <PageSection title="Ringkasan Perkiraan" id="summary">
        <MetricStrip>
          <MetricCard
            label={`Perkiraan permintaan · ${s.horizonDays} hari`}
            value={formatNumber(s.forecastValue)}
            unit={d.product.unit}
            context={`rata-rata ${formatNumber(Math.round(s.forecastValue / s.horizonDays))} per hari`}
          />
          <MetricCard label="Perubahan vs proses sebelumnya" value={formatDeltaPercent(s.deltaPercent)} delta={<ForecastDelta percent={s.deltaPercent} size="sm" />} context={`${formatDeltaNumber(s.delta)} ${d.product.unit} (sebelumnya ${formatNumber(s.previousForecast)})`} />
          <MetricCard label="Perubahan vs aktual terakhir" value={formatDeltaPercent(vsActual)} context={`Permintaan aktual ${s.horizonDays} hari sebelumnya: ${formatNumber(s.actualLastPeriod)}`} />
          <MetricCard
            label="Perubahan manual"
            value={d.row?.overrideUnits != null ? formatNumber(d.row.overrideUnits) : "Tidak ada"}
            unit={d.row?.overrideUnits != null ? d.product.unit : undefined}
            context={
              d.overrides.find((o) => o.status === "pending_approval")
                ? "Ada perubahan manual yang menunggu persetujuan."
                : d.row?.overrideUnits != null
                  ? "Diterapkan pada acuan perencanaan."
                  : "Perkiraan model yang dipakai untuk perencanaan."
            }
          />
        </MetricStrip>
      </PageSection>

      <ForecastChart
        title="Permintaan historis dan perkiraan"
        points={pointsWindow}
        unit={`${d.product.unit} per hari`}
        source="Transaksi POS, pesanan penjualan ERP"
        asOf={d.run.dataAsOf}
        summary={`Periode perkiraan ${formatDateRange(s.periodStart, s.periodEnd)}. Perkiraan permintaan ${formatNumber(s.forecastValue)} ${d.product.unit}; rentang ${formatNumber(s.lowerBound)} – ${formatNumber(s.upperBound)} ${d.product.unit}.`}
        height={320}
      />

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Rentang Perkiraan" description="Seberapa lebar rentang yang mungkin terjadi, dan bagaimana proses ini dibanding proses sebelumnya.">
          <DescriptionList
            columns={3}
            items={[
              { label: "Perkiraan permintaan", value: <span className="numeric-md">{formatNumber(s.forecastValue)}</span> },
              { label: "Rentang perkiraan", value: <span className="tabular">{formatNumber(s.lowerBound)} – {formatNumber(s.upperBound)}</span> },
              { label: "Cakupan", value: formatPercent(s.coverage, 0), hint: "Bagian hasil yang diperkirakan berada di dalam rentang" },
            ]}
          />
          <ForecastInterval className="mt-5" lower={s.lowerBound} upper={s.upperBound} forecast={s.forecastValue} comparison={s.previousForecast} override={d.row?.overrideUnits} unit={d.product.unit} coverage={s.coverage} />
          <p className="mt-4 body-sm text-fg-secondary">
            Pada 8 dari 10 periode yang sebanding, permintaan aktual berada di antara {formatNumber(s.lowerBound)} dan {formatNumber(s.upperBound)} {d.product.unit}. Rentangnya {formatPercent(width, 0)} dari perkiraan
            {width > 0.9 ? ", yang tergolong lebar: gunakan angka perkiraan dengan hati-hati." : "."} Definisi rentang masih perlu dikonfirmasi dengan pemilik analitik.
          </p>
        </Panel>
        <Panel title="Pendorong dan asumsi" description="Apa yang dipakai model dan apa yang mungkin belum tercakup.">
          <ul className="flex flex-col gap-3">
            {d.signals.map((sig) => {
              const Icon = sig.effect === "up" ? ArrowUpRight : sig.effect === "down" ? ArrowDownRight : Minus;
              return (
                <li key={sig.label} className="flex items-start gap-3">
                  <span className={cn("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm border", sig.effect === "neutral" ? "border-border bg-subtle text-fg-tertiary" : "border-border bg-subtle text-fg-secondary")}>
                    <Icon className="size-3.5" aria-label={sig.effect === "up" ? "Menaikkan permintaan" : sig.effect === "down" ? "Menurunkan permintaan" : "Membentuk permintaan"} />
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
              <p className="mb-1.5 metadata">Skenario yang mencakup kategori ini</p>
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
        <Panel title="Informasi model">
          <div className="flex flex-col gap-4">
            <ModelIdentity model={d.model} showStatus />
            {d.model && (
              <DescriptionList
                columns={2}
                items={[
                  { label: "Versi", value: d.model.version },
                  { label: "Terakhir dilatih", value: formatDate(d.model.lastTrainedAt) },
                  { label: "Periode pelatihan", value: formatDateRange(d.model.trainingStart, d.model.trainingEnd) },
                  { label: "WAPE portofolio", value: formatPercent(d.model.metrics.wape), hint: `${formatDate(d.model.metrics.evaluationStart)} – ${formatDate(d.model.metrics.evaluationEnd)}` },
                ]}
              />
            )}
            {d.model && d.model.limitations.length > 0 && (
              <div>
                <p className="mb-1 metadata">Batasan yang diketahui</p>
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
          title={`Perlu Ditinjau (${openEx.length} terbuka)`}
          flush
          actions={
            <Link href={`/planning/exceptions?q=${encodeURIComponent(d.product.sku)}`} className="text-xs font-semibold text-primary hover:underline">
              Lihat di Perlu Ditinjau
            </Link>
          }
        >
          {d.exceptions.length === 0 ? (
            <p className="px-4 py-6 caption">Belum ada item yang perlu ditinjau untuk produk ini.</p>
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
        <Panel title="Perubahan manual" description="Setiap perubahan manual, siapa yang membuatnya dan alasannya.">
          {d.overrides.length === 0 ? (
            <p className="caption">Belum ada perubahan manual untuk produk ini.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {d.overrides.map((o) => (
                <li key={o.id} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="body-sm font-semibold">
                      {formatNumber(o.originalUnits)} → {formatNumber(o.newUnits)} unit ({formatDeltaPercent((o.newUnits - o.originalUnits) / o.originalUnits)})
                    </span>
                    <StatusBadge status={o.status === "applied" ? "approved" : o.status === "pending_approval" ? "pending" : "rejected"} label={o.status === "applied" ? "Diterapkan" : o.status === "pending_approval" ? "Menunggu persetujuan" : "Ditolak"} size="sm" />
                  </div>
                  <p className="mt-1 caption">
                    {OVERRIDE_REASONS.find((r) => r.value === o.reason)?.label} · {o.productIds.length > 1 ? `bagian dari perubahan ${o.productIds.length} SKU` : "hanya SKU ini"}
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
        <Panel title="Riwayat aktivitas">
          <AuditTimeline events={d.audit} emptyText="Belum ada perubahan tercatat untuk produk ini." />
        </Panel>
      </div>

      <OverrideDialog open={overrideOpen} onOpenChange={setOverrideOpen} runId={d.run.id} productIds={[d.product.id]} originalUnits={s.forecastValue} label={d.product.name} horizonDays={s.horizonDays} />
    </PageContainer>
  );
}
