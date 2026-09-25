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
    success: "Simulation complete",
    failure: "The simulation did not run.",
    onSuccess: () => track("scenario_simulated", {}),
  });
  const submit = useApiMutation((c, v: string) => submitScenario(c, scenarioId, v), {
    invalidate: inv,
    success: "Submitted for review",
    successDescription: "A Manager will review the assumptions and impact.",
    failure: "The scenario was not submitted.",
    onSuccess: () => setSubmitOpen(false),
  });
  const duplicate = useApiMutation((c, _v: void) => duplicateScenario(c, scenarioId), { invalidate: inv, success: (s) => `Created “${s.name}”`, failure: "The scenario was not duplicated.", onSuccess: (s) => router.push(`/scenarios/${s.id}?edit=1`) });
  const archive = useApiMutation((c, _v: void) => archiveScenario(c, scenarioId), { invalidate: inv, success: "Scenario archived", failure: "The scenario was not archived." });

  if (q.isPending) return <PageContainer><PageSkeleton /></PageContainer>;
  if (q.isError) {
    return (
      <PageContainer>
        <PageHeader title="Scenario" />
        <Panel>
          <ErrorState what="This scenario could not be loaded." error={q.error} onRetry={() => q.refetch()} recovery={<Link href="/scenarios" className={buttonVariants({ variant: "secondary" })}>Back to scenarios</Link>} />
        </Panel>
      </PageContainer>
    );
  }
  const { scenario: s, baseline, approval, audit } = q.data;
  const editable = s.status === "draft" || s.status === "simulated" || s.status === "rejected";

  if (editing && editable) {
    return (
      <PageContainer>
        <PageHeader title={`Edit scenario · ${s.name}`} description="Saving resets the simulation. Run it again to update the impact." />
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
            <MetaItem>Owner {actorName(s.ownerId)}</MetaItem>
            <MetaItem>
              Baseline{" "}
              <Link href={`/forecasting/runs/${s.baselineRunId}`} className="mono-id text-primary hover:underline">
                {s.baselineRunId}
              </Link>
            </MetaItem>
            <MetaItem>Modified {formatDateTime(s.modifiedAt)}</MetaItem>
          </>
        }
        actions={
          <>
            {can("scenario.create") && (
              <Button variant="secondary" onClick={() => duplicate.mutate()} loading={duplicate.isPending}>
                <Copy aria-hidden /> Duplicate
              </Button>
            )}
            {can("scenario.create") && s.status !== "archived" && s.status !== "in_review" && (
              <Button variant="ghost" onClick={() => archive.mutate()} loading={archive.isPending}>
                <Archive aria-hidden /> Archive
              </Button>
            )}
            {editable && can("scenario.create") && (
              <Link href={`/scenarios/${s.id}?edit=1`} className={buttonVariants({ variant: "secondary" })}>
                <Pencil aria-hidden /> Edit assumptions
              </Link>
            )}
            {r && (
              <Link href={`/scenarios/compare?ids=${s.id}`} className={buttonVariants({ variant: "secondary" })}>
                <GitCompareArrows aria-hidden /> Compare
              </Link>
            )}
            {!r && can("scenario.create") && s.status !== "archived" && (
              <Button variant="primary" onClick={() => simulate.mutate()} loading={simulate.isPending} loadingText="Simulating">
                <Play aria-hidden /> Run simulation
              </Button>
            )}
            {r && s.status === "simulated" && can("scenario.submit") && (
              <Button variant="primary" onClick={() => { setNote(""); setSubmitOpen(true); }}>
                <Send aria-hidden /> Submit for review
              </Button>
            )}
          </>
        }
      />
      {s.status === "in_review" && approval && (
        <InlineAlert tone="info" title="In review." action={<Link href={`/planning/approvals?id=${approval.id}`} className={buttonVariants({ size: "sm" })}>View approval</Link>}>
          Submitted {formatDateTime(approval.requestedAt)}. Due {formatDate(approval.dueAt)}. The scenario cannot be edited while it is in review.
        </InlineAlert>
      )}
      {s.status === "rejected" && approval && (
        <InlineAlert tone="critical" title="Rejected.">
          {approval.history[approval.history.length - 1]?.text} Edit the assumptions and submit again.
        </InlineAlert>
      )}
      {s.status === "approved" && <InlineAlert tone="success" title="Approved. This scenario can be used as a planning baseline." />}

      {r ? (
        <>
          <Panel title="Impact" description={`Simulated ${formatDateTime(r.simulatedAt)} against ${s.baselineRunId}${baseline ? ` (${baseline.horizonDays}-day horizon)` : ""}.`}>
            <ImpactPreview result={r} />
          </Panel>
          <ChartFrame
            title="Baseline vs scenario"
            question="How does daily demand change under this scenario?"
            unit="units per day"
            timeframe={`${formatDate(r.points[0]?.date)} – ${formatDate(r.points[r.points.length - 1]?.date)}`}
            source={`Baseline ${s.baselineRunId}`}
            summary={`Total demand ${formatDeltaPercent(r.deltaPercent)} (${formatDeltaNumber(r.deltaUnits)} units) versus the baseline.`}
            legend={
              <>
                <LegendItem color="var(--chart-forecast)" label="Baseline" />
                <LegendItem color="var(--chart-scenario)" label="Scenario" />
              </>
            }
            chart={<ScenarioChart rows={r.points.map((p) => ({ date: p.date, baseline: p.baseline, scenario: p.scenario }))} scenarios={[{ key: "scenario", label: s.name }]} />}
            table={
              <ChartDataTable
                caption="Daily baseline and scenario"
                columns={[{ key: "d", label: "Date" }, { key: "b", label: "Baseline", numeric: true }, { key: "s", label: "Scenario", numeric: true }, { key: "x", label: "Change", numeric: true }]}
                rows={r.points.map((p) => ({ d: formatDate(p.date), b: formatNumber(p.baseline), s: formatNumber(p.scenario), x: formatDeltaPercent(p.baseline ? (p.scenario - p.baseline) / p.baseline : 0) }))}
              />
            }
          />
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={Play}
            title="This scenario has not been simulated yet."
            description="Run the simulation to see how the assumptions change demand versus the baseline."
            action={can("scenario.create") ? <Button variant="primary" onClick={() => simulate.mutate()} loading={simulate.isPending}>Run simulation</Button> : undefined}
          />
        </Panel>
      )}

      <PageSection title="Assumptions" description="Every change shows the baseline, the new value, the delta and its rationale.">
        <Panel flush>
          <div className="p-4">
            <ChartDataTable
              caption="Scenario assumptions"
              maxHeight="none"
              columns={[
                { key: "driver", label: "Driver" },
                { key: "scope", label: "Scope" },
                { key: "base", label: "Baseline", numeric: true },
                { key: "value", label: "Changed", numeric: true },
                { key: "delta", label: "Delta", numeric: true },
                { key: "effect", label: "Demand effect", numeric: true },
                { key: "why", label: "Source / rationale" },
              ]}
              rows={s.assumptions.map((a) => ({
                driver: DRIVER_LABELS[a.driver],
                scope: a.scope,
                base: `${a.baselineValue}${a.unit === "pp" ? "%" : a.unit}`,
                value: `${a.value}${a.unit === "pp" ? "%" : a.unit}`,
                delta: `${a.value - a.baselineValue >= 0 ? "+" : "−"}${Math.abs(a.value - a.baselineValue)}${a.unit === "pp" ? " pp" : a.unit}`,
                effect: formatDeltaPercent(assumptionEffect(a)),
                why: <span className="whitespace-normal text-fg-secondary">{a.rationale}</span>,
              }))}
            />
          </div>
        </Panel>
      </PageSection>

      <Panel title="History">
        <AuditTimeline events={audit} emptyText="No recorded changes to this scenario." />
      </Panel>

      <Dialog open={submitOpen} onOpenChange={setSubmitOpen}>
        {r && (
          <DialogContent
            title="Submit scenario for review?"
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
                { label: "What will change?", value: `Total demand ${formatDeltaPercent(r.deltaPercent)} (${formatDeltaNumber(r.deltaUnits)} units) if adopted.`, emphasis: true },
                { label: "Assumptions", value: `${s.assumptions.length} (${s.assumptions.map((a) => a.scope).join(", ")})` },
                { label: "While in review", value: "The scenario is locked. Duplicate it to explore alternatives." },
                { label: "Approver", value: "Manager" },
              ]}
            />
            <Field className="mt-4" label="Note for the reviewer" htmlFor="scn-note" optional>
              <Textarea id="scn-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Context the reviewer needs" />
            </Field>
          </DialogContent>
        )}
      </Dialog>
    </PageContainer>
  );
}
