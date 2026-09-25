"use client";

import { Archive, Copy, GitCompareArrows, Pencil, Play, Send } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { archiveScenario, duplicateScenario, getScenario, simulateSavedScenario, submitScenario } from "@/lib/api/planning";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { actorName } from "@/lib/mock/directory";
import { assumptionEffect, DRIVER_LABELS } from "@/lib/mock/scenarios";
import { formatDate, formatDateTime, formatDeltaNumber, formatDeltaPercent, formatNumber } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
import { track } from "@/lib/telemetry";
import { Button, buttonVariants } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { MetaItem, PageContainer, PageHeader, PageSection, Panel } from "@/components/page/page";
import { StatusBadge } from "@/components/feedback/status";
import { EmptyState, ErrorState, InlineAlert, PageSkeleton } from "@/components/feedback/states";
import { ChartDataTable, ChartFrame, LegendItem } from "@/components/charts/chart-frame";
import { ScenarioChart } from "@/components/charts/scenario-chart";
import { AuditTimeline, ConsequenceSummary } from "@/components/governance/audit";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { ImpactPreview } from "./impact-preview";
import { ScenarioBuilder } from "./scenario-builder";

export function ScenarioDetailView({ scenarioId }: { scenarioId: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const editing = params.get("edit") === "1";
  const { can } = useSession();
  const q = useApiQuery(["scenario", scenarioId], (c) => getScenario(c, scenarioId));
  useBreadcrumbLeaf(q.data?.scenario.name ?? null);
  const [submitOpen, setSubmitOpen] = React.useState(false);
  const [note, setNote] = React.useState("");

  const inv = [["scenario"], ["scenarios"], ["approvals"], ["nav-counts"]] as const;
  const simulate = useApiMutation((c, _v: void) => simulateSavedScenario(c, scenarioId), {
    invalidate: inv,
    success: "Simulasi selesai",
    failure: "Simulasi tidak berjalan.",
    onSuccess: () => track("scenario_simulated", {}),
  });
  const submit = useApiMutation((c, v: string) => submitScenario(c, scenarioId, v), {
    invalidate: inv,
    success: "Dikirim untuk ditinjau",
    successDescription: "A Manager will review the assumptions and impact.",
    failure: "Skenario tidak dapat dikirim.",
    onSuccess: () => setSubmitOpen(false),
  });
  const duplicate = useApiMutation((c, _v: void) => duplicateScenario(c, scenarioId), { invalidate: inv, success: (s) => `Membuat “${s.name}”`, failure: "Skenario tidak dapat diduplikat.", onSuccess: (s) => router.push(`/scenarios/${s.id}?edit=1`) });
  const archive = useApiMutation((c, _v: void) => archiveScenario(c, scenarioId), { invalidate: inv, success: "Skenario diarsipkan", failure: "Skenario tidak dapat diarsipkan." });

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Skenario" />
        <Panel>
          <ErrorState what="Skenario ini tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} recovery={<Link href="/scenarios" className={buttonVariants({ variant: "secondary" })}>Kembali ke Skenario</Link>} />
        </Panel>
      </PageContainer>
    );
  }
  const { scenario: s, baseline, approval, audit } = q.data;
  const editable = s.status === "draft" || s.status === "simulated" || s.status === "rejected";

  if (editing && editable) {
    return (
      <PageContainer>
        <PageHeader title={`Ubah Skenario · ${s.name}`} description="Menyimpan akan mengatur ulang simulasi. Jalankan lagi untuk memperbarui dampaknya." />
        <ScenarioBuilder initial={s} />
      </PageContainer>
    );
  }

  const r = s.result;
  return (
    <PageContainer>
      <PageHeader
        title={s.name}
        description={s.description || undefined}
        meta={
          <>
            <StatusBadge status={s.status} />
            <MetaItem>Penanggung jawab {actorName(s.ownerId)}</MetaItem>
            <MetaItem>
              Acuan{" "}
              <Link href={`/forecasting/runs/${s.baselineRunId}`} className="mono-id text-primary hover:underline">
                {s.baselineRunId}
              </Link>
            </MetaItem>
            <MetaItem>Diubah {formatDateTime(s.modifiedAt)}</MetaItem>
          </>
        }
        actions={
          <>
            {can("scenario.create") && (
              <Button variant="secondary" onClick={() => duplicate.mutate()} loading={duplicate.isPending}>
                <Copy aria-hidden /> Duplikat
              </Button>
            )}
            {can("scenario.create") && s.status !== "archived" && s.status !== "in_review" && (
              <Button variant="ghost" onClick={() => archive.mutate()} loading={archive.isPending}>
                <Archive aria-hidden /> Arsipkan
              </Button>
            )}
            {editable && can("scenario.create") && (
              <Link href={`/scenarios/${s.id}?edit=1`} className={buttonVariants({ variant: "secondary" })}>
                <Pencil aria-hidden /> Ubah asumsi
              </Link>
            )}
            {r && (
              <Link href={`/scenarios/compare?ids=${s.id}`} className={buttonVariants({ variant: "secondary" })}>
                <GitCompareArrows aria-hidden /> Bandingkan
              </Link>
            )}
            {!r && can("scenario.create") && s.status !== "archived" && (
              <Button variant="primary" onClick={() => simulate.mutate()} loading={simulate.isPending} loadingText="Menyimulasikan">
                <Play aria-hidden /> Jalankan Simulasi
              </Button>
            )}
            {r && s.status === "simulated" && can("scenario.submit") && (
              <Button variant="primary" onClick={() => { setNote(""); setSubmitOpen(true); }}>
                <Send aria-hidden /> Kirim untuk persetujuan
              </Button>
            )}
          </>
        }
      />
      {s.status === "in_review" && approval && (
        <InlineAlert tone="info" title="Sedang ditinjau." action={<Link href={`/planning/approvals?id=${approval.id}`} className={buttonVariants({ size: "sm" })}>Lihat persetujuan</Link>}>
          Dikirim {formatDateTime(approval.requestedAt)}. Batas {formatDate(approval.dueAt)}. Skenario tidak dapat diubah selama ditinjau.
        </InlineAlert>
      )}
      {s.status === "rejected" && approval && (
        <InlineAlert tone="critical" title="Ditolak.">
          {approval.history[approval.history.length - 1]?.text} Ubah asumsinya lalu kirim lagi.
        </InlineAlert>
      )}
      {s.status === "approved" && <InlineAlert tone="success" title="Disetujui. Skenario ini dapat dipakai sebagai acuan perencanaan." />}

      {r ? (
        <>
          <Panel title="Dampak" description={`Disimulasikan ${formatDateTime(r.simulatedAt)} terhadap ${s.baselineRunId}${baseline ? ` (periode ${baseline.horizonDays} hari)` : ""}.`}>
            <ImpactPreview result={r} />
          </Panel>
          <ChartFrame
            title="Acuan vs skenario"
            question="Bagaimana permintaan harian berubah pada skenario ini?"
            unit="units per day"
            timeframe={`${formatDate(r.points[0]?.date)} – ${formatDate(r.points[r.points.length - 1]?.date)}`}
            source={`Baseline ${s.baselineRunId}`}
            summary={`Total demand ${formatDeltaPercent(r.deltaPercent)} (${formatDeltaNumber(r.deltaUnits)} units) versus the baseline.`}
            legend={
              <>
                <LegendItem color="var(--chart-forecast)" label="Acuan" />
                <LegendItem color="var(--chart-scenario)" label="Skenario" />
              </>
            }
            chart={<ScenarioChart rows={r.points.map((p) => ({ date: p.date, baseline: p.baseline, scenario: p.scenario }))} scenarios={[{ key: "scenario", label: s.name }]} />}
            table={
              <ChartDataTable
                caption="Acuan dan skenario harian"
                columns={[{ key: "d", label: "Tanggal" }, { key: "b", label: "Acuan", numeric: true }, { key: "s", label: "Skenario", numeric: true }, { key: "x", label: "Perubahan", numeric: true }]}
                rows={r.points.map((p) => ({ d: formatDate(p.date), b: formatNumber(p.baseline), s: formatNumber(p.scenario), x: <SignedPercent percent={p.baseline ? (p.scenario - p.baseline) / p.baseline : 0} /> }))}
              />
            }
          />
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={Play}
            title="Skenario ini belum disimulasikan."
            description="Jalankan simulasi untuk melihat bagaimana asumsi mengubah permintaan dibanding acuan."
            action={can("scenario.create") ? <Button variant="primary" onClick={() => simulate.mutate()} loading={simulate.isPending}>Jalankan Simulasi</Button> : undefined}
          />
        </Panel>
      )}

      <PageSection title="Asumsi" description="Setiap perubahan menampilkan acuan, nilai baru, selisih, dan alasannya.">
        <Panel flush>
          <div className="p-4">
            <ChartDataTable
              caption="Asumsi skenario"
              maxHeight="none"
              columns={[
                { key: "driver", label: "Pendorong" },
                { key: "scope", label: "Cakupan" },
                { key: "base", label: "Acuan", numeric: true },
                { key: "value", label: "Diubah", numeric: true },
                { key: "delta", label: "Selisih", numeric: true },
                { key: "effect", label: "Efek permintaan", numeric: true },
                { key: "why", label: "Sumber / alasan" },
              ]}
              rows={s.assumptions.map((a) => ({
                driver: DRIVER_LABELS[a.driver],
                scope: a.scope,
                base: `${a.baselineValue}${a.unit === "pp" ? "%" : a.unit}`,
                value: `${a.value}${a.unit === "pp" ? "%" : a.unit}`,
                delta: `${a.value - a.baselineValue >= 0 ? "+" : "−"}${Math.abs(a.value - a.baselineValue)}${a.unit === "pp" ? " pp" : a.unit}`,
                effect: <SignedPercent percent={assumptionEffect(a)} />,
                why: <span className="whitespace-normal text-fg-secondary">{a.rationale}</span>,
              }))}
            />
          </div>
        </Panel>
      </PageSection>

      <Panel title="Riwayat">
        <AuditTimeline events={audit} emptyText="Belum ada perubahan tercatat pada skenario ini." />
      </Panel>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        {r && (
          <DialogContent
            title="Kirim skenario untuk ditinjau?"
            description="A Manager decides whether this scenario can be adopted into a plan."
            footer={
              <>
                <Button variant="ghost" onClick={() => setSubmitOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={submit.isPending} onClick={() => submit.mutate(note)}>
                  Submit for review
                </Button>
              </>
            }
          >
            <ConsequenceSummary
              rows={[
                { label: "Apa yang berubah?", value: `Total permintaan ${formatDeltaPercent(r.deltaPercent)} (${formatDeltaNumber(r.deltaUnits)} unit) bila dipakai.`, emphasis: true },
                { label: "Asumsi", value: `${s.assumptions.length} (${s.assumptions.map((a) => a.scope).join(", ")})` },
                { label: "Selama ditinjau", value: "Skenario terkunci. Duplikat untuk menelusuri alternatif lain." },
                { label: "Penyetuju", value: "Manajer" },
              ]}
            />
            <Field className="mt-4" label="Catatan untuk peninjau" htmlFor="scn-note" optional>
              <Textarea id="scn-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Konteks yang dibutuhkan peninjau" />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </PageContainer>
  );
}
