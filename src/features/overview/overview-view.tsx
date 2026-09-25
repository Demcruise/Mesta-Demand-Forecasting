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

/** Severity and exception-type display labels (v3 §73: no raw backend names in the UI). */
const SEVERITY_LABELS = { critical: "Kritis", warning: "Peringatan", info: "Info" } as const;
const EXCEPTION_TYPE_LABELS: Record<string, string> = {
  large_delta: "Perubahan besar",
  low_confidence: "Rentang lebar",
  high_error: "Selisih tinggi",
  data_freshness: "Data belum diperbarui",
  data_quality: "Masalah data",
  model_anomaly: "Anomali model",
  manual_override: "Diubah manual",
  threshold_breach: "Melewati batas",
};

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
        <PageHeader title="Ringkasan" />
        <Panel>
          <ErrorState what="Ringkasan tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} retryLabel="Coba muat ulang ringkasan" />
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
        <PageHeader title="Ringkasan" description={`${workspace.name} · ${workspace.environment}`} />
        <Panel>
          <EmptyState
            title="Belum ada perkiraan yang diterbitkan di ruang kerja ini."
            description="Ringkasan menampilkan proses perkiraan terbit terakhir. Ikuti panduan persiapan untuk menyambungkan data, menjalankan perkiraan pertama, lalu menerbitkannya."
            action={
              <Link href="/onboarding" className={buttonVariants({ variant: "primary" })}>
                Lanjutkan persiapan ruang kerja
              </Link>
            }
            secondaryAction={
              can("forecast.run.create") ? (
                <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "secondary" })}>
                  <Plus aria-hidden /> Buat Perkiraan
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
        title="Ringkasan"
        description="Lihat kondisi permintaan, keandalan perkiraan, dan hal yang perlu diperhatikan."
        actions={
          can("forecast.run.create") ? (
            <Link href="/forecasting/runs/new" className={buttonVariants({ variant: "primary" })}>
              <Plus aria-hidden /> Buat Perkiraan
            </Link>
          ) : undefined
        }
        meta={
          <>
            <MetaItem>
              Cakupan: {scopeLabel(base)} · {formatNumber(base.scope.skuCount)} SKU · {base.scope.locationCount} lokasi
            </MetaItem>
            <MetaItem>Periode perkiraan: {formatDateRange(new Date(periodStart), new Date(periodEnd))} ({base.horizonDays} hari)</MetaItem>
            <MetaItem>
              Acuan:{" "}
              <Link href={`/forecasting/runs/${base.id}`} className="mono-id text-primary hover:underline">
                {base.id}
              </Link>
            </MetaItem>
            <FreshnessIndicator timestamp={pos?.lastSuccessAt} label="Data POS diperbarui" source="Transaksi POS" />
          </>
        }
      />

      {/* Needs attention */}
      <PageSection title="Perlu Ditinjau" description="Diurutkan berdasarkan tingkat kepentingan. Setiap item tertaut ke tindakannya." id="attention">
        {d.attention.length === 0 ? (
          <Panel>
            <EmptyState compact title="Tidak ada yang perlu ditinjau saat ini." description="Tidak ada masalah data yang menghambat, perubahan besar, proses gagal, atau persetujuan tertunda." />
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
                      "group flex h-full flex-col rounded-lg border bg-surface p-4 transition-colors hover:border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
                      a.severity === "critical" ? "border-critical/30" : "border-border",
                    )}
                  >
                    <span className="flex items-start gap-2.5">
                      <Icon className={cn("mt-0.5 size-4 shrink-0", a.severity === "critical" ? "text-critical" : a.severity === "warning" ? "text-warning" : "text-info")} aria-hidden />
                      <span className="min-w-0">
                        <span className="sr-only">{SEVERITY_LABELS[a.severity]}: </span>
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
      <PageSection title="Kesehatan Perkiraan" description={`Dari acuan terbit ${base.id}, periode ${base.horizonDays} hari.`} id="health">
        <MetricStrip>
          <MetricCard
            label={`Total Permintaan · ${base.horizonDays} hari ke depan`}
            value={formatNumber(s.forecast)}
            unit="unit"
            delta={<ForecastDelta percent={s.deltaPercent} size="sm" />}
            context={`Rentang 80% ${formatNumber(s.lower)} – ${formatNumber(s.upper)} · ${formatDeltaPercent(s.deltaPercent)} dibanding perkiraan sebelumnya`}
            href="/forecasting/explorer"
            hrefLabel="Buka Perkiraan Permintaan"
            tooltip="Jumlah perkiraan harian untuk semua SKU dalam cakupan selama periode perkiraan. Rentangnya menggabungkan rentang tiap SKU."
          />
          <MetricCard
            label="Akurasi Perkiraan (WAPE)"
            value={d.accuracy ? formatPercent(d.accuracy.wape) : "—"}
            context={
              d.accuracyWindow
                ? `Uji model ${d.accuracyWindow.id}, ${formatDate(d.accuracyWindow.start)} – ${formatDate(d.accuracyWindow.end)}. Semakin kecil semakin baik.`
                : "Belum ada uji model untuk model ini."
            }
            href="/models/performance"
            hrefLabel="Lihat performa model"
            tooltip="Weighted absolute percentage error: total selisih absolut dibagi total permintaan aktual."
          />
          <MetricCard
            label="Bias Perkiraan"
            value={d.accuracy ? formatDeltaPercent(d.accuracy.bias) : "—"}
            context="Nilai positif berarti model cenderung memperkirakan terlalu tinggi. Target dalam ±3%."
            href="/models/performance"
            hrefLabel="Lihat bias per kategori"
            tooltip="Rata-rata selisih bertanda dibagi rata-rata permintaan aktual selama periode uji model."
          />
          <MetricCard
            label="Perlu Ditinjau"
            value={formatNumber(d.exceptions.open)}
            context={`${d.exceptions.critical} kritis · ${d.exceptions.warning} peringatan`}
            href="/planning/exceptions?status=open,investigating,escalated"
            hrefLabel="Tinjau item"
          />
        </MetricStrip>
      </PageSection>

      {/* Demand outlook */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <ForecastChart
          title="Tren Permintaan"
          points={d.points}
          unit="unit per hari"
          source="Transaksi POS, pesanan penjualan ERP"
          asOf={base.dataAsOf}
          summary={`Permintaan yang diperkirakan untuk ${base.horizonDays} hari ke depan adalah ${formatNumber(s.forecast)} unit (rentang 80% ${formatNumber(s.lower)}–${formatNumber(s.upper)}), ${formatDeltaPercent(s.vsActualPercent)} dibanding permintaan aktual ${base.horizonDays} hari sebelumnya.`}
          height={300}
        />
        <ChartFrame
          title="Perkiraan per kategori"
          question="Kategori mana yang menyebabkan perubahan dibanding perkiraan sebelumnya?"
          unit="unit"
          timeframe={`${base.horizonDays} hari ke depan`}
          legend={
            <>
              <LegendItem color="var(--chart-previous)" label="Perkiraan sebelumnya" variant="bar" />
              <LegendItem color="var(--chart-forecast)" label="Perkiraan saat ini" variant="bar" />
            </>
          }
          chart={<PairedBars rows={d.byCategory.map((c) => ({ label: c.category, a: c.previous, b: c.forecast }))} aLabel="Perkiraan sebelumnya" bLabel="Perkiraan saat ini" />}
          table={
            <ChartDataTable
              caption="Perkiraan per kategori"
              columns={[
                { key: "c", label: "Kategori" },
                { key: "p", label: "Sebelumnya", numeric: true },
                { key: "f", label: "Perkiraan", numeric: true },
                { key: "d", label: "Perubahan", numeric: true },
              ]}
              rows={d.byCategory.map((c) => ({ c: c.category, p: formatNumber(c.previous), f: formatNumber(c.forecast), d: formatDeltaPercent(c.previous ? (c.forecast - c.previous) / c.previous : 0) }))}
            />
          }
        />
      </div>

      {/* Exception queue + runs */}
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Perubahan terbesar untuk ditinjau"
          description="Item terbuka dengan perubahan terbesar dibanding perkiraan sebelumnya."
          flush
          actions={
            <Link href="/planning/exceptions" className="text-xs font-semibold text-primary hover:underline">
              Semua item
            </Link>
          }
        >
          {d.exceptions.top.length === 0 ? (
            <EmptyState compact title="Tidak ada perubahan besar yang perlu ditinjau." description="Semua perubahan perkiraan masih dalam batas tinjauan." />
          ) : (
            <ul>
              {d.exceptions.top.map((e) => (
                <li key={e.id} className="border-b border-border-subtle last:border-b-0">
                  <Link href={`/planning/exceptions?id=${e.id}`} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-2.5 hover:bg-hover focus-visible:bg-hover focus-visible:outline-none">
                    <ProductIdentity product={e.product} />
                    <SeverityBadge severity={e.severity} size="sm" />
                    <span className="w-20 text-right">
                      {e.valueUnit === "%" && e.type === "large_delta" ? <ForecastDelta percent={e.value} size="sm" /> : <span className="text-xs text-fg-secondary">{EXCEPTION_TYPE_LABELS[e.type] ?? e.type}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel
          title="Proses Perkiraan Terbaru"
          flush
          actions={
            <Link href="/forecasting/runs" className="text-xs font-semibold text-primary hover:underline">
              Semua proses
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
        <Panel title="Model yang digunakan">
          <div className="flex flex-col gap-3">
            <ModelIdentity model={d.model} showStatus />
            <p className="caption">
              Menghasilkan {base.id}. Terakhir dilatih {d.model ? formatDate(d.model.lastTrainedAt) : "—"}. {d.model?.limitations[0]}
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={d.model ? `/models/${d.model.id}` : "/models"} className={buttonVariants({ size: "sm" })}>
                Lihat detail model
              </Link>
              <Link href="/forecasting/lineage" className={buttonVariants({ size: "sm", variant: "ghost" })}>
                Telusuri sumber keputusan
              </Link>
            </div>
          </div>
        </Panel>
        <Panel
          title="Aktivitas Terbaru"
          actions={
            can("audit.view") ? (
              <Link href="/administration/audit" className="text-xs font-semibold text-primary hover:underline">
                Riwayat Aktivitas
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
