"use client";

import { Archive, FlaskConical, Star } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { ModelMetrics } from "@/types/domain";
import { archiveModel, getModel, requestDefaultModel } from "@/lib/api/models";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDate, formatDateRange, formatDateTime, formatDecimal, formatNumber, formatPercent } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
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
      return <SignedPercent percent={m.bias} />;
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
      caption="Metrik performa model"
      maxHeight="none"
      columns={[
        { key: "metric", label: "Metrik" },
        { key: "value", label: "Nilai", numeric: true },
        { key: "definition", label: "Penjelasan" },
        { key: "baseline", label: "Pembanding" },
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
    success: "Permintaan promosi dikirim",
    successDescription: "A Manager must approve before new runs use this model by default.",
    failure: "Permintaan tidak dapat dibuat.",
    onSuccess: () => setDialog(null),
  });
  const archive = useApiMutation((c, _v: void) => archiveModel(c, modelId), { invalidate: [["model"], ["models"]], success: "Model diarsipkan", failure: "Model tidak dapat diarsipkan.", onSuccess: () => setDialog(null) });

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Model" />
        <Panel>
          <ErrorState what="Model ini tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} recovery={<Link href="/models" className={buttonVariants({ variant: "secondary" })}>Kembali ke Daftar Model</Link>} />
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
            {m.isDefault && <Tag tone="primary">Model bawaan</Tag>}
            <MetaItem>Terakhir dilatih {formatDateTime(m.lastTrainedAt)}</MetaItem>
            <MetaItem>
              Penanggung jawab <UserIdentity userId={m.owner} className="ml-1" />
            </MetaItem>
          </>
        }
        actions={
          <>
            {can("backtest.run") && (
              <Link href={`/models/backtesting?model=${m.id}`} className={buttonVariants({ variant: "secondary" })}>
                <FlaskConical aria-hidden /> Jalankan Uji Model
              </Link>
            )}
            {can("model.manage") && !m.isDefault && m.status !== "archived" && (
              <Button variant="secondary" onClick={() => setDialog("archive")}>
                <Archive aria-hidden /> Arsipkan
              </Button>
            )}
            {can("model.manage") && !m.isDefault && m.status !== "archived" && (
              <Button variant="primary" onClick={() => { setRationale(""); setDialog("default"); }} disabled={!!pendingApproval}>
                <Star aria-hidden /> Ajukan sebagai bawaan
              </Button>
            )}
          </>
        }
      />
      {pendingApproval && (
        <InlineAlert tone="info" title="Permintaan menjadikan model ini bawaan sedang menunggu persetujuan." action={<Link href={`/planning/approvals?id=${pendingApproval.id}`} className={buttonVariants({ size: "sm" })}>Lihat permintaan</Link>}>
          Diajukan {formatDateTime(pendingApproval.requestedAt)}.
        </InlineAlert>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Panel title="Performa" description={`Evaluasi terakhir ${formatDateRange(m.metrics.evaluationStart, m.metrics.evaluationEnd)} · ${m.metrics.population}`}>
          <MetricTable metrics={m.metrics} />
        </Panel>
        <Panel title="Detail versi">
          <DescriptionList
            items={[
              { label: "Versi", value: m.version },
              { label: "Periode pelatihan", value: formatDateRange(m.trainingStart, m.trainingEnd) },
              { label: "Dataset", value: m.dataset },
              { label: "Rentang perkiraan", value: `Hingga ${m.horizonDays} hari` },
              { label: "Frekuensi", value: m.frequency === "daily" ? "Harian" : "Mingguan" },
            ]}
          />
          <div className="mt-4">
            <p className="mb-1.5 metadata">Fitur</p>
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
          title={`Uji model ${latest.id}: perkiraan vs aktual`}
          question="Seberapa dekat perkiraan model ini mengikuti permintaan aktual sebelumnya?"
          points={latest.points}
          unit="unit per hari"
          source={`Uji model ${latest.id}`}
          summary={`Selama ${formatDateRange(latest.windowStart, latest.windowEnd)}, WAPE sebesar ${formatPercent(latest.metrics?.wape ?? 0)} dan ${formatPercent(latest.metrics?.coverage80 ?? 0, 0)} hari berada di dalam rentang 80%.`}
          height={260}
        />
      ) : (
        <Panel title="Uji Model">
          <p className="caption">Belum ada uji model yang selesai untuk model ini.</p>
        </Panel>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Batasan yang diketahui">
          <ul className="list-disc pl-5 body-sm text-fg-secondary">
            {m.limitations.map((l) => (
              <li key={l} className="mb-1">
                {l}
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title="Penggunaan" description={`${formatNumber(m.usage.runs)} proses perkiraan · terakhir dipakai ${formatDate(m.usage.lastUsedAt)}`} flush>
          {runs.length === 0 ? (
            <p className="px-4 py-6 caption">Belum ada proses di ruang kerja ini yang memakai model ini.</p>
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
      <Panel title="Riwayat">
        <AuditTimeline events={audit} emptyText="Belum ada perubahan tercatat pada model ini." />
      </Panel>

      <Dialog open={dialog === "default"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          title={`Ajukan ${m.name} ${m.version} sebagai model bawaan?`}
          description="Promosi model selalu melalui persetujuan Manajer."
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Batal
              </Button>
              <Button variant="primary" disabled={rationale.trim().length < 10} loading={promote.isPending} onClick={() => promote.mutate(rationale)}>
                Kirim untuk persetujuan
              </Button>
            </>
          }
        >
          <ConsequenceSummary
            rows={[
              { label: "Yang berubah", value: "Proses perkiraan baru memakai model ini kecuali memilih model lain." },
              { label: "Yang tidak berubah", value: "Proses yang sudah ada, acuan saat ini, dan rencana yang terbuka." },
              { label: "Bukti terlampir", value: backtests.length ? backtests.map((b) => b.id).join(", ") : "Belum ada uji model. Jalankan dulu." },
              { label: "Persetujuan", value: "Manajer" },
            ]}
          />
          <Field className="mt-4" label="Alasan" htmlFor="promo-why" required hint="Minimal 10 karakter. Tercatat bersama permintaan.">
            <Textarea id="promo-why" value={rationale} onChange={(e) => setRationale(e.target.value)} placeholder="mis. WAPE lebih rendah dan rentang lebih terkalibrasi dalam 90 hari terakhir." />
          </Field>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "archive"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent
          size="sm"
          title={`Arsipkan ${m.name} ${m.version}?`}
          footer={
            <>
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Batal
              </Button>
              <Button variant="primary" loading={archive.isPending} onClick={() => archive.mutate()}>
                Arsipkan model
              </Button>
            </>
          }
        >
          <p className="body-sm text-fg-secondary">Model yang diarsipkan tidak dapat dipilih untuk proses perkiraan baru. Proses dan uji model yang sudah ada tetap merujuk ke model ini.</p>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
