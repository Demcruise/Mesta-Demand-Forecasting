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
import { pick } from "@/lib/i18n";

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
    success: pick("Simulasi selesai", "Simulation complete"),
    failure: pick("Simulasi tidak berjalan.", "The simulation did not run."),
    onSuccess: () => track("scenario_simulated", {}),
  });
  const submit = useApiMutation((c, v: string) => submitScenario(c, scenarioId, v), {
    invalidate: inv,
    success: pick("Dikirim untuk ditinjau", "Submitted for review"),
    successDescription: "A Manager will review the assumptions and impact.",
    failure: pick("Skenario tidak dapat dikirim.", "The scenario was not submitted."),
    onSuccess: () => setSubmitOpen(false),
  });
  const duplicate = useApiMutation((c, _v: void) => duplicateScenario(c, scenarioId), { invalidate: inv, success: (s) => pick(`Membuat “${s.name}”`, `Created “${s.name}”`), failure: pick("Skenario tidak dapat diduplikat.", "The scenario was not duplicated."), onSuccess: (s) => router.push(`/scenarios/${s.id}?edit=1`) });
  const archive = useApiMutation((c, _v: void) => archiveScenario(c, scenarioId), { invalidate: inv, success: pick("Skenario diarsipkan", "Scenario archived"), failure: pick("Skenario tidak dapat diarsipkan.", "The scenario was not archived.") });

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title={pick("Skenario", "Scenario")} />
        <Panel>
          <ErrorState what={pick("Skenario ini tidak dapat dimuat.", "This scenario could not be loaded.")} error={q.error} onRetry={() => q.refetch()} recovery={<Link href="/scenarios" className={buttonVariants({ variant: "secondary" })}>{pick("Kembali ke Skenario", "Back to scenarios")}</Link>} />
        </Panel>
      </PageContainer>
    );
  }
  const { scenario: s, baseline, approval, audit } = q.data;
  const editable = s.status === "draft" || s.status === "simulated" || s.status === "rejected";

  if (editing && editable) {
    return (
      <PageContainer>
        <PageHeader title={pick(`Ubah Skenario · ${s.name}`, `Edit scenario · ${s.name}`)} description={pick("Menyimpan akan mengatur ulang simulasi. Jalankan lagi untuk memperbarui dampaknya.", "Saving resets the simulation. Run it again to update the impact.")} />
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
              <Button variant="primary" onClick={() => simulate.mutate()} loading={simulate.isPending} loadingText={pick("Menyimulasikan", "Simulating")}>
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
        <InlineAlert tone="info" title={pick("Sedang ditinjau.", "In review.")} action={<Link href={`/planning/approvals?id=${approval.id}`} className={buttonVariants({ size: "sm" })}>{pick("Lihat persetujuan", "View approval")}</Link>}>
          Dikirim {formatDateTime(approval.requestedAt)}. Batas {formatDate(approval.dueAt)}. Skenario tidak dapat diubah selama ditinjau.
        </InlineAlert>
      )}
      {s.status === "rejected" && approval && (
        <InlineAlert tone="critical" title={pick("Ditolak.", "Rejected.")}>
          {approval.history[approval.history.length - 1]?.text} Ubah asumsinya lalu kirim lagi.
        </InlineAlert>
      )}
      {s.status === "approved" && <InlineAlert tone="success" title={pick("Disetujui. Skenario ini dapat dipakai sebagai acuan perencanaan.", "Approved. This scenario can be used as a planning baseline.")} />}

      {r ? (
        <>
          <Panel title={pick("Dampak", "Impact")} description={pick(`Disimulasikan ${formatDateTime(r.simulatedAt)} terhadap ${s.baselineRunId}${baseline ? ` (periode ${baseline.horizonDays} hari)` : ""}.`, `Simulated ${formatDateTime(r.simulatedAt)} against ${s.baselineRunId}${baseline ? ` (${baseline.horizonDays}-day horizon)` : ""}.`)}>
            <ImpactPreview result={r} />
          </Panel>
          <ChartFrame
            title={pick("Acuan vs skenario", "Baseline vs scenario")}
            question={pick("Bagaimana permintaan harian berubah pada skenario ini?", "How does daily demand change under this scenario?")}
            unit={pick("unit per hari", "units per day")}
            timeframe={`${formatDate(r.points[0]?.date)} – ${formatDate(r.points[r.points.length - 1]?.date)}`}
            source={`Baseline ${s.baselineRunId}`}
            summary={`Total demand ${formatDeltaPercent(r.deltaPercent)} (${formatDeltaNumber(r.deltaUnits)} units) versus the baseline.`}
            legend={
              <>
                <LegendItem color="var(--chart-forecast)" label={pick("Acuan", "Baseline")} />
                <LegendItem color="var(--chart-scenario)" label={pick("Skenario", "Scenario")} />
              </>
            }
            chart={<ScenarioChart rows={r.points.map((p) => ({ date: p.date, baseline: p.baseline, scenario: p.scenario }))} scenarios={[{ key: "scenario", label: s.name }]} />}
            table={
              <ChartDataTable
                caption={pick("Acuan dan skenario harian", "Daily baseline and scenario")}
                columns={[{ key: "d", label: pick("Tanggal", "Date") }, { key: "b", label: pick("Acuan", "Baseline"), numeric: true }, { key: "s", label: pick("Skenario", "Scenario"), numeric: true }, { key: "x", label: pick("Perubahan", "Change"), numeric: true }]}
                rows={r.points.map((p) => ({ d: formatDate(p.date), b: formatNumber(p.baseline), s: formatNumber(p.scenario), x: <SignedPercent percent={p.baseline ? (p.scenario - p.baseline) / p.baseline : 0} /> }))}
              />
            }
          />
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={Play}
            title={pick("Skenario ini belum disimulasikan.", "This scenario has not been simulated yet.")}
            description={pick("Jalankan simulasi untuk melihat bagaimana asumsi mengubah permintaan dibanding acuan.", "Run the simulation to see how the assumptions change demand versus the baseline.")}
            action={can("scenario.create") ? <Button variant="primary" onClick={() => simulate.mutate()} loading={simulate.isPending}>{pick("Jalankan Simulasi", "Run simulation")}</Button> : undefined}
          />
        </Panel>
      )}

      <PageSection title={pick("Asumsi", "Assumptions")} description={pick("Setiap perubahan menampilkan acuan, nilai baru, selisih, dan alasannya.", "Every change shows the baseline, the new value, the delta and its rationale.")}>
        <Panel flush>
          <div className="p-4">
            <ChartDataTable
              caption={pick("Asumsi skenario", "Scenario assumptions")}
              maxHeight="none"
              columns={[
                { key: "driver", label: pick("Pendorong", "Driver") },
                { key: "scope", label: pick("Cakupan", "Scope") },
                { key: "base", label: pick("Acuan", "Baseline"), numeric: true },
                { key: "value", label: pick("Diubah", "Changed"), numeric: true },
                { key: "delta", label: pick("Selisih", "Delta"), numeric: true },
                { key: "effect", label: pick("Efek permintaan", "Demand effect"), numeric: true },
                { key: "why", label: pick("Sumber / alasan", "Source / rationale") },
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

      <Panel title={pick("Riwayat", "History")}>
        <AuditTimeline events={audit} emptyText={pick("Belum ada perubahan tercatat pada skenario ini.", "No recorded changes to this scenario.")} />
      </Panel>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        {r && (
          <DialogContent
            title={pick("Kirim skenario untuk ditinjau?", "Submit scenario for review?")}
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
                { label: pick("Apa yang berubah?", "What will change?"), value: pick(`Total permintaan ${formatDeltaPercent(r.deltaPercent)} (${formatDeltaNumber(r.deltaUnits)} unit) bila dipakai.`, `Total demand ${formatDeltaPercent(r.deltaPercent)} (${formatDeltaNumber(r.deltaUnits)} units) if adopted.`), emphasis: true },
                { label: pick("Asumsi", "Assumptions"), value: `${s.assumptions.length} (${s.assumptions.map((a) => a.scope).join(", ")})` },
                { label: pick("Selama ditinjau", "While in review"), value: pick("Skenario terkunci. Duplikat untuk menelusuri alternatif lain.", "The scenario is locked. Duplicate it to explore alternatives.") },
                { label: pick("Penyetuju", "Approver"), value: pick("Manajer", "Manager") },
              ]}
            />
            <Field className="mt-4" label={pick("Catatan untuk peninjau", "Note for the reviewer")} htmlFor="scn-note" optional>
              <Textarea id="scn-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={pick("Konteks yang dibutuhkan peninjau", "Context the reviewer needs")} />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </PageContainer>
  );
}
