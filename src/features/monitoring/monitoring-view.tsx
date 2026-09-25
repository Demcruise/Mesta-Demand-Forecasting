"use client";

import { AlertOctagon, AlertTriangle, CheckCircle2, CircleSlash } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ServiceHealth } from "@/types/domain";
import { getMonitoring } from "@/lib/api/governance";
import { useApiQuery } from "@/hooks/use-api";
import { formatDate, formatDateTime, formatRelative, formatShortDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { SeverityBadge, StatusBadge } from "@/components/feedback/status";
import { ErrorState, PageSkeleton } from "@/components/feedback/states";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { RunIdentity, scopeLabel } from "@/components/entities/identity";
import { pick, localized } from "@/lib/i18n";

const HEALTH = localized({
  operational: { label: "Normal", icon: CheckCircle2, cls: "text-success" },
  degraded: { label: "Perlu Perhatian", icon: AlertTriangle, cls: "text-warning" },
  down: { label: "Gangguan", icon: AlertOctagon, cls: "text-critical" },
} as const, {
  operational: { label: "Operational", icon: CheckCircle2, cls: "text-success" },
  degraded: { label: "Degraded", icon: AlertTriangle, cls: "text-warning" },
  down: { label: "Down", icon: AlertOctagon, cls: "text-critical" },
} as const);

const KIND_LABELS: Record<ServiceHealth["kind"], string> = localized({ service: "Layanan platform", pipeline: pick("Alur perkiraan", "Forecast pipeline"), source: pick("Sumber data", "Data sources"), model: pick("Model produksi", "Production models") }, { service: "Platform services", pipeline: "Forecast pipeline", source: pick("Sumber data", "Data sources"), model: pick("Model produksi", "Production models") });

/** PAGE-MONITORING: operational health of pipelines and data dependencies. */
export function MonitoringView() {
  const q = useApiQuery(["monitoring"], getMonitoring, { refetchInterval: 15_000 });
  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) return <PageContainer><PageHeader title={pick("Pemantauan", "Monitoring")} /><Panel><ErrorState what={pick("Data pemantauan tidak dapat dimuat.", "Monitoring data could not be loaded.")} error={q.error} onRetry={() => q.refetch()} /></Panel></PageContainer>;
  const { services, alerts, jobs, history } = q.data;
  const down = services.filter((s) => s.status === "down").length;
  const degraded = services.filter((s) => s.status === "degraded").length;
  const overall = down ? "down" : degraded ? "degraded" : "operational";
  const O = HEALTH[overall];
  const kinds: ServiceHealth["kind"][] = ["service", "pipeline", "source", "model"];

  return (
    <PageContainer>
      <PageHeader title={pick("Pemantauan", "Monitoring")} description={pick("Pantau proses perkiraan, sumber data, dan model produksi. Menyegarkan setiap 15 detik.", "Health of forecasting jobs, data sources and production models. Refreshes every 15 seconds.")} />
      <div className={cn("flex items-center gap-3 rounded-lg border bg-surface p-4", overall === "down" ? "border-critical/30" : overall === "degraded" ? "border-warning/30" : "border-border")} role="status">
        <O.icon className={cn("size-6 shrink-0", O.cls)} aria-hidden />
        <div>
          <p className="section-title">{overall === "operational" ? pick("Semua sistem normal", "All systems operational") : `${down ? `${down} gangguan` : ""}${down && degraded ? " · " : ""}${degraded ? `${degraded} perlu perhatian` : ""}`}</p>
          <p className="caption">Diperiksa {formatRelative(services[0]?.checkedAt)} · {services.length} komponen dipantau</p>
        </div>
      </div>

      <PageSection title={pick("Peringatan", "Alerts")} description={pick("Peringatan aktif, terbaru lebih dulu.", "Active alerts, newest first.")}>
        <Panel flush>
          {alerts.length === 0 ? (
            <p className="px-4 py-6 caption">{pick("Tidak ada peringatan aktif.", "No active alerts.")}</p>
          ) : (
            <ul>
              {alerts.map((a) => (
                <li key={a.id} className="border-b border-border-subtle last:border-b-0">
                  <Link href={a.href} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3 hover:bg-hover">
                    <SeverityBadge severity={a.severity} size="sm" />
                    <span className="min-w-0">
                      <span className="block body-sm font-semibold">{a.title}</span>
                      <span className="block caption">{a.detail}</span>
                    </span>
                    <span className="text-right text-xs text-fg-tertiary">
                      {formatRelative(a.raisedAt)}
                      <span className="block">{a.acknowledged ? pick("Sudah ditanggapi", "Acknowledged") : pick("Belum ditanggapi", "Not acknowledged")}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </PageSection>

      <PageSection title={pick("Kesehatan sistem", "System health")}>
        <div className="grid auto-rows-fr gap-4 lg:grid-cols-2">
          {kinds.map((k) => (
            <Panel key={k} title={KIND_LABELS[k]} flush>
              <ul>
                {services
                  .filter((s) => s.kind === k)
                  .map((s) => {
                    const H = HEALTH[s.status];
                    return (
                      <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border-subtle px-4 py-2.5 last:border-b-0">
                        <span className="min-w-0">
                          <span className="block truncate body-sm font-semibold">{s.name}</span>
                          <span className="block truncate caption" title={s.detail}>{s.detail}</span>
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold">
                          <H.icon className={cn("size-4", H.cls)} aria-hidden />
                          {H.label}
                        </span>
                      </li>
                    );
                  })}
                {services.filter((s) => s.kind === k).length === 0 && (
                  <li className="flex items-center gap-2 px-4 py-3 caption">
                    <CircleSlash className="size-4" aria-hidden /> Tidak ada yang dipantau.
                  </li>
                )}
              </ul>
            </Panel>
          ))}
        </div>
      </PageSection>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title={pick("Proses perkiraan · 14 hari terakhir", "Forecast jobs · last 14 days")}
          question={pick("Apakah proses terjadwal dan ad-hoc selesai dengan baik?", "Are scheduled and ad-hoc runs completing?")}
          unit={pick("proses per hari", "runs per day")}
          timeframe={`${formatDate(history[0]?.day)} – ${formatDate(history[history.length - 1]?.day)}`}
          source={pick("Penjadwal proses perkiraan", "Forecast job scheduler")}
          summary={pick(`${history.reduce((s, d) => s + d.succeeded, 0)} proses berhasil dan ${history.reduce((s, d) => s + d.failed, 0)} gagal dalam 14 hari terakhir.`, `${history.reduce((s, d) => s + d.succeeded, 0)} runs succeeded and ${history.reduce((s, d) => s + d.failed, 0)} failed in the last 14 days.`)}
          legend={
            <>
              <LegendItem color="var(--chart-series-1)" label="Berhasil" variant="bar" />
              <LegendItem color="var(--critical)" label="Gagal" variant="bar" />
            </>
          }
          chart={
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="day" tickFormatter={(v: string) => formatShortDate(v)} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickLine={false} axisLine={{ stroke: "var(--chart-grid)" }} minTickGap={20} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--chart-axis)" }} tickLine={false} axisLine={false} width={28} />
                  <Tooltip cursor={{ fill: "var(--bg-hover)" }} labelFormatter={(v) => formatDate(v as string)} contentStyle={{ background: "var(--bg-surface)", border: "1px solid var(--border-default)", borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="succeeded" name="Succeeded" stackId="a" fill="var(--chart-series-1)" isAnimationActive={false} />
                  <Bar dataKey="failed" name="Failed" stackId="a" fill="var(--critical)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          }
          table={
            <ChartDataTable
              caption={pick("Proses perkiraan per hari", pick("Pekerjaan perkiraan per hari", "Forecast jobs per day"))}
              columns={[{ key: "d", label: pick("Hari", "Day") }, { key: "s", label: pick("Berhasil", "Succeeded"), numeric: true }, { key: "f", label: pick("Gagal", "Failed"), numeric: true }, { key: "m", label: pick("Rata-rata durasi", "Avg duration"), numeric: true }]}
              rows={history.map((h) => ({ d: formatDate(h.day), s: h.succeeded, f: h.failed, m: `${h.durationMin} min` }))}
            />
          }
        />
        <Panel title={pick("Proses perkiraan terbaru", "Recent forecast jobs")} flush actions={<Link href="/forecasting/runs" className="text-xs font-semibold text-primary hover:underline">{pick("Semua proses", "All runs")}</Link>}>
          <ul>
            {jobs.map((r) => (
              <li key={r.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border-subtle px-4 py-2.5 last:border-b-0 sm:grid-cols-[minmax(0,1fr)_9rem_auto]">
                <RunIdentity run={r} />
                <span className="hidden truncate text-xs text-fg-secondary sm:block" title={formatDateTime(r.createdAt)}>
                  {scopeLabel(r)}
                </span>
                <StatusBadge status={r.status} size="sm" />
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </PageContainer>
  );
}

