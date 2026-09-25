"use client";

import { ArrowRight, CheckCircle2, Circle, PartyPopper, PlugZap } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { setSourceConnection, listSources } from "@/lib/api/data";
import { confirmWorkspace, getOnboarding, runReadinessChecks, setOnboardingDismissed, type OnboardingStep } from "@/lib/api/onboarding";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { rolesWith, ROLE_LABELS } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageContainer, PageHeader, Panel } from "@/components/page/page";
import { ErrorState, InlineAlert, PageSkeleton } from "@/components/feedback/states";
import { StatusBadge } from "@/components/feedback/status";
import { useBreadcrumbLeaf } from "@/components/shell/app-shell";
import { pick } from "@/lib/i18n";

const INVALIDATE = [["onboarding"], ["sources"], ["overview"], ["dq"], ["nav-counts"], ["runs"]] as const;

/**
 * ONBOARDING-001: shown when a workspace has no usable forecast context. Progress is
 * derived from the workspace, and the guide can be hidden; it is never forced.
 */
export function OnboardingView() {
  useBreadcrumbLeaf(pick("Persiapan Ruang Kerja", "Workspace setup"));
  const q = useApiQuery(["onboarding"], getOnboarding, { refetchInterval: 5000 });
  const dismiss = useApiMutation((c, v: boolean) => setOnboardingDismissed(c, v), { invalidate: INVALIDATE, failure: pick("Panduan persiapan tidak dapat diperbarui.", "The setup guide was not updated.") });

  if (q.isPending) return <PageContainer width="narrow"><PageSkeleton /></PageContainer>;
  if (q.isError) return <PageContainer width="narrow"><PageHeader title={pick("Persiapan Ruang Kerja", "Workspace setup")} /><Panel><ErrorState what={pick("Panduan persiapan tidak dapat dimuat.", "The setup guide could not be loaded.")} error={q.error} onRetry={() => q.refetch()} /></Panel></PageContainer>;
  const d = q.data;
  const required = d.steps.filter((s) => !s.optional);
  const requiredDone = required.filter((s) => s.done).length;
  const percent = Math.round((requiredDone / required.length) * 100);
  const nextKey = d.steps.find((s) => !s.done && !s.optional)?.key;

  return (
    <PageContainer width="narrow">
      <PageHeader
        eyebrow={`${d.workspace.name} · ${d.workspace.environment}`}
        title={d.complete ? pick("Persiapan selesai", "Setup complete") : pick(`Siapkan ${d.workspace.name}`, `Set up ${d.workspace.name}`)}
        description={d.complete ? pick("Ruang kerja ini sudah memiliki data dan acuan terbit. Bagian lain Mesta kini memakai angka yang nyata.", "This workspace has data and a published baseline. The rest of Mesta now works with real numbers.") : pick("Lima langkah membawa ruang kerja ini dari katalog kosong sampai acuan perencanaan yang diterbitkan. Tiap langkah diperbarui begitu pekerjaannya selesai, di mana pun Anda mengerjakannya.", "Five steps take this workspace from an empty catalogue to a published planning baseline. Each step updates as soon as the work is done, wherever you do it.")}
        actions={
          !d.dismissed ? (
            <Button variant="ghost" loading={dismiss.isPending} onClick={() => dismiss.mutate(true)}>
              Hide setup guide
            </Button>
          ) : undefined
        }
      />
      <div className="flex items-center gap-3" aria-live="polite">
        <div role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={pick("Progres persiapan", "Setup progress")} className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
        </div>
        <p className="shrink-0 caption tabular">
          {requiredDone} of {required.length} required steps done
        </p>
      </div>

      {d.complete && (
        <InlineAlert
          tone="success"
          title={pick("Ruang kerja sudah siap.", "The workspace is ready.")}
          action={
            <Link href="/overview" className={buttonVariants({ variant: "primary", size: "sm" })}>
              <PartyPopper aria-hidden /> Go to overview
            </Link>
          }
        >
          Exceptions, scenarios and plans now use the published baseline.
        </InlineAlert>
      )}

      <ol className="flex flex-col gap-3" aria-label={pick("Langkah persiapan", "Setup steps")}>
        {d.steps.map((step, i) => (
          <StepCard key={step.key} step={step} index={i} current={step.key === nextKey} nextRunId={d.nextRunId} />
        ))}
      </ol>
    </PageContainer>
  );
}

function StepCard({ step, index, current, nextRunId }: { step: OnboardingStep; index: number; current: boolean; nextRunId: string | null }) {
  const { can } = useSession();
  const allowed = step.permission ? can(step.permission) : true;
  const who = step.permission ? rolesWith(step.permission).map((r) => ROLE_LABELS[r]).join(" or ") : "";
  return (
    <li
      className={cn("rounded-lg border bg-surface p-4", current ? "border-primary/40 ring-4 ring-primary-subtle" : "border-border")}
      aria-current={current ? "step" : undefined}
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 shrink-0">
          {step.done ? <CheckCircle2 className="size-5 text-success" aria-label={pick("Selesai", "Done")} /> : <Circle className={cn("size-5", current ? "text-primary" : "text-border-strong")} aria-label={pick("Belum selesai", "Not done")} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className={cn("card-title", step.done && "text-fg-secondary")}>
              {index + 1}. {step.title}
            </h2>
            {step.optional && <span className="caption">{pick("Opsional", "Optional")}</span>}
          </div>
          <p className="mt-0.5 body-sm text-fg-secondary">{step.description}</p>
          {step.detail && <p className="mt-1 caption font-semibold">{step.detail}</p>}
          {!step.done && (
            <div className="mt-3">
              {allowed ? <StepAction step={step} nextRunId={nextRunId} /> : <p className="caption">Needs {who}. Ask them to complete this step; it updates here automatically.</p>}
            </div>
          )}
          {step.done && step.key === "forecast" && nextRunId && (
            <Link href={`/forecasting/runs/${nextRunId}`} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
              Open {nextRunId} <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function StepAction({ step, nextRunId }: { step: OnboardingStep; nextRunId: string | null }) {
  const confirm = useApiMutation((c, _v: void) => confirmWorkspace(c), { invalidate: INVALIDATE, success: pick("Detail ruang kerja dikonfirmasi", "Workspace details confirmed"), failure: pick("Ruang kerja tidak dapat dikonfirmasi.", "The workspace was not confirmed.") });
  const checks = useApiMutation((c, _v: void) => runReadinessChecks(c), {
    invalidate: INVALIDATE,
    success: (r) => (r.blocking ? pick(`${r.blocking} temuan menghambat`, `${r.blocking} blocking issues found`) : pick("Tidak ada temuan yang menghambat", "No blocking issues found")),
    successDescription: (r) => (r.warnings ? pick(`${r.warnings} peringatan untuk ditinjau di Kualitas Data. Tidak menghambat perkiraan.`, pick(`${r.warnings} peringatan untuk ditinjau di Kualitas Data. Tidak menghambat perkiraan.`, `${r.warnings} warning to review in Data quality. It does not block forecasting.`)) : undefined),
    failure: pick("Pemeriksaan data tidak berjalan.", "Data checks did not run."),
  });
  const sources = useApiQuery(["sources"], listSources, { enabled: step.key === "source" });
  const connect = useApiMutation((c, id: string) => setSourceConnection(c, id, true), {
    invalidate: INVALIDATE,
    success: (s) => `${s.name} connected`,
    successDescription: pick("Permintaan historis sedang diisi ulang.", "Historical demand is being backfilled."),
    failure: pick("Sumber tidak dapat disambungkan.", "The source was not connected."),
  });

  switch (step.key) {
    case "workspace":
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" loading={confirm.isPending} onClick={() => confirm.mutate()}>
            Confirm workspace details
          </Button>
          <Link href="/administration/settings/workspace" className={buttonVariants({ size: "sm", variant: "ghost" })}>
            Review settings
          </Link>
        </div>
      );
    case "source":
      return (
        <ul className="flex flex-col gap-2">
          {(sources.data ?? [])
            .filter((s) => s.type === "POS" || s.type === "ERP")
            .map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2">
                <span className="min-w-0">
                  <span className="block body-sm font-semibold">{s.name}</span>
                  <span className="block caption">{s.description}</span>
                </span>
                {s.status === "disconnected" ? (
                  <Button size="sm" variant="secondary" loading={connect.isPending && connect.variables === s.id} onClick={() => connect.mutate(s.id)}>
                    <PlugZap aria-hidden /> Connect
                  </Button>
                ) : (
                  <StatusBadge status={s.status} size="sm" />
                )}
              </li>
            ))}
        </ul>
      );
    case "readiness":
      return (
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" size="sm" loading={checks.isPending} loadingText={pick("Menjalankan pemeriksaan", "Running checks")} onClick={() => checks.mutate()}>
            Run data checks
          </Button>
          <Link href="/demand-data/quality" className={buttonVariants({ size: "sm", variant: "ghost" })}>
            Open data quality
          </Link>
        </div>
      );
    case "forecast":
      return nextRunId ? (
        <Link href={`/forecasting/runs/${nextRunId}`} className={buttonVariants({ size: "sm", variant: "secondary" })}>
          Follow {nextRunId}
        </Link>
      ) : (
        <Link href="/forecasting/runs/new?name=First%20forecast%20%C2%B7%20All%20categories" className={buttonVariants({ size: "sm", variant: "primary" })}>
          Create forecast run
        </Link>
      );
    case "publish":
      return nextRunId ? (
        <Link href={`/forecasting/runs/${nextRunId}`} className={buttonVariants({ size: "sm", variant: "primary" })}>
          Review and publish {nextRunId}
        </Link>
      ) : (
        <p className="caption">Available after the first run completes.</p>
      );
    case "team":
      return (
        <Link href="/administration/users" className={buttonVariants({ size: "sm", variant: "secondary" })}>
          Invite teammates
        </Link>
      );
  }
}
