"use client";

import { Archive, Ban, Copy, Eye, MoreHorizontal, RotateCcw, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ForecastRun } from "@/types/domain";
import { archiveRun, cancelRun, publishRun, retryRun } from "@/lib/api/forecasting";
import { useApiMutation } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDateTime, formatNumber } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { ConsequenceSummary } from "@/components/governance/audit";
import { scopeLabel } from "@/components/entities/identity";
import { pick } from "@/lib/i18n";

type Confirm = { kind: "cancel" | "publish" | "archive"; run: ForecastRun } | null;

const RUN_KEYS = [["runs"], ["run"], ["overview"], ["nav-counts"], ["notifications"], ["forecast-rows"], ["run-result"]] as const;

/** Mutations for a run, with consequence dialogs for high-impact actions. */
export function useRunActions(baselineId?: string | null) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [reason, setReason] = React.useState("");

  const cancel = useApiMutation((ctx, v: { id: string; reason: string }) => cancelRun(ctx, v.id, v.reason), {
    invalidate: RUN_KEYS,
    success: (r) => pick(`${r.id} dibatalkan`, `Cancelled ${r.id}`),
    successDescription: pick("Tidak ada hasil yang disimpan. Anda dapat menjalankan ulang nanti.", "No results were written. You can retry the run later."),
    failure: pick("Proses tidak dapat dibatalkan.", "The run was not cancelled."),
    onSuccess: () => setConfirm(null),
  });
  const retry = useApiMutation((ctx, id: string) => retryRun(ctx, id), {
    invalidate: RUN_KEYS,
    success: (r) => pick(`Menjalankan ulang ${r.id}`, `Retrying ${r.id}`),
    successDescription: pick("Proses masuk antrean dan akan segera dimulai.", "The run is queued and will start shortly."),
    failure: pick("Proses tidak dapat dijalankan ulang.", "The run could not be retried."),
    onSuccess: (r) => {
      track("forecast_run_started", { retry: true });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });
  const publish = useApiMutation((ctx, v: { id: string; reason: string }) => publishRun(ctx, v.id, v.reason), {
    invalidate: RUN_KEYS,
    success: (r) => pick(`${r.id} diterbitkan`, `Published ${r.id}`),
    successDescription: pick("Proses ini kini menjadi acuan perencanaan ruang kerja.", "It is now the planning baseline for this workspace."),
    failure: pick("Proses tidak dapat diterbitkan.", "The run was not published."),
    onSuccess: () => setConfirm(null),
  });
  const archive = useApiMutation((ctx, id: string) => archiveRun(ctx, id), {
    invalidate: RUN_KEYS,
    success: (r) => pick(`${r.id} diarsipkan`, `Archived ${r.id}`),
    failure: pick("Proses tidak dapat diarsipkan.", "The run was not archived."),
    onSuccess: () => setConfirm(null),
  });

  const open = (kind: NonNullable<Confirm>["kind"], run: ForecastRun) => {
    setReason("");
    setConfirm({ kind, run });
  };

  const dialog = (
    <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
      {confirm && (
        <DialogContent
          size="md"
          title={confirm.kind === "cancel" ? pick(`Batalkan ${confirm.run.id}?`, `Cancel ${confirm.run.id}?`) : confirm.kind === "publish" ? pick(`Terbitkan ${confirm.run.id} sebagai acuan perencanaan?`, `Publish ${confirm.run.id} as the planning baseline?`) : pick(`Arsipkan ${confirm.run.id}?`, `Archive ${confirm.run.id}?`)}
          description={
            confirm.kind === "publish"
              ? pick("Menerbitkan akan menggantikan acuan yang dipakai Ringkasan, Perkiraan Permintaan, Perlu Ditinjau, dan rencana.", "Publishing replaces the current baseline used by the overview, explorer, exceptions and plans.")
              : confirm.kind === "cancel"
                ? pick("Pemrosesan berhenti dan tidak ada hasil yang disimpan.", "Processing stops and no results are written.")
                : pick("Proses yang diarsipkan tetap dapat dilihat untuk referensi, tetapi tidak dapat diterbitkan.", "Archived runs stay available for reference but cannot be published.")
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {confirm.kind === "cancel" ? pick("Tetap jalankan", "Keep running") : pick("Kembali", "Back")}
              </Button>
              {confirm.kind === "cancel" && (
                <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate({ id: confirm.run.id, reason })}>
                  {pick("Batalkan proses perkiraan", "Cancel forecast run")}
                </Button>
              )}
              {confirm.kind === "publish" && (
                <Button variant="primary" loading={publish.isPending} disabled={reason.trim().length < 5} onClick={() => publish.mutate({ id: confirm.run.id, reason })}>
                  {pick("Terbitkan sebagai acuan", "Publish as baseline")}
                </Button>
              )}
              {confirm.kind === "archive" && (
                <Button variant="primary" loading={archive.isPending} onClick={() => archive.mutate(confirm.run.id)}>
                  {pick("Arsipkan proses", "Archive run")}
                </Button>
              )}
            </>
          }
        >
          <ConsequenceSummary
            rows={[
              { label: pick("Proses", "Run"), value: `${confirm.run.name} (${confirm.run.id})` },
              { label: pick("Cakupan", "Scope"), value: pick(`${scopeLabel(confirm.run)} · ${formatNumber(confirm.run.scope.skuCount)} SKU`, `${scopeLabel(confirm.run)} · ${formatNumber(confirm.run.scope.skuCount)} SKUs`) },
              { label: pick("Rentang", "Horizon"), value: pick(`${confirm.run.horizonDays} hari · model ${confirm.run.modelVersion}`, `${confirm.run.horizonDays} days · model ${confirm.run.modelVersion}`) },
              ...(confirm.kind === "publish"
                ? [
                    { label: pick("Menggantikan", "Replaces"), value: baselineId && baselineId !== confirm.run.id ? baselineId : pick("Belum ada acuan", "No current baseline") },
                    { label: pick("Dampak", "Consequence"), value: pick("Item yang perlu ditinjau dievaluasi ulang terhadap proses ini. Rencana yang terbuka tetap memakai acuannya sampai dibangun ulang.", "Exceptions are re-evaluated against this run. Open plans keep their current baseline until rebuilt."), emphasis: true },
                    { label: pick("Izin", "Permission"), value: pick("Menerbitkan proses perkiraan (Manajer atau Administrator)", "Publish forecast runs (Manager or Administrator)") },
                  ]
                : confirm.kind === "cancel"
                  ? [{ label: pick("Dimulai", "Started"), value: formatDateTime(confirm.run.startedAt) }, { label: pick("Dampak", "Consequence"), value: pick("Pekerjaan yang sudah berjalan akan dibuang.", "Work done so far is discarded."), emphasis: true }]
                  : [{ label: pick("Dampak", "Consequence"), value: pick("Proses disembunyikan dari daftar bawaan dan tidak dapat menjadi acuan.", "The run is hidden from default lists and cannot become a baseline."), emphasis: true }]),
            ]}
          />
          {(confirm.kind === "publish" || confirm.kind === "cancel") && (
            <Field
              className="mt-4"
              label={confirm.kind === "publish" ? pick("Alasan menerbitkan", "Reason for publishing") : pick("Alasan membatalkan", "Reason for cancelling")}
              htmlFor="run-reason"
              optional={confirm.kind === "cancel"}
              required={confirm.kind === "publish"}
              hint={confirm.kind === "publish" ? pick("Tercatat di riwayat aktivitas. Minimal 5 karakter.", "Recorded in the audit log. At least 5 characters.") : pick("Tercatat di riwayat aktivitas.", "Recorded in the audit log.")}
            >
              <Textarea id="run-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={confirm.kind === "publish" ? pick("mis. Sudah divalidasi dengan aktual kemarin", "e.g. Validated against yesterday's actuals") : pick("mis. Wilayah yang dipilih salah", "e.g. Wrong region selected")} />
            </Field>
          )}
        </DialogContent>
      )}
    </Dialog>
  );

  return { open, retry, dialog };
}

/** Row action menu; items are permission-aware and state-aware. */
export function RunActionMenu({ run, actions, baselineId }: { run: ForecastRun; actions: ReturnType<typeof useRunActions>; baselineId?: string | null }) {
  const router = useRouter();
  const { can } = useSession();
  const active = run.status === "queued" || run.status === "running";
  const hasResults = run.status === "completed" || run.status === "published" || run.status === "archived";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={pick(`Aksi untuk ${run.id}`, `Actions for ${run.id}`)} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem icon={<Eye />} onSelect={() => router.push(`/forecasting/runs/${run.id}`)}>
          {active ? pick("Lihat progres", "View progress") : pick("Buka proses", "Open run")}
        </DropdownMenuItem>
        {hasResults && (
          <DropdownMenuItem icon={<Eye />} onSelect={() => router.push(`/forecasting/explorer?run=${run.id}`)}>
            {pick("Lihat hasil", "View results")}
          </DropdownMenuItem>
        )}
        {can("forecast.run.create") && (
          <DropdownMenuItem icon={<Copy />} onSelect={() => router.push(`/forecasting/runs/new?from=${run.id}`)}>
            {pick("Duplikat pengaturan", "Duplicate configuration")}
          </DropdownMenuItem>
        )}
        {(run.status === "failed" || run.status === "cancelled") && can("forecast.run.create") && (
          <DropdownMenuItem icon={<RotateCcw />} onSelect={() => actions.retry.mutate(run.id)}>
            {pick("Jalankan ulang", "Retry")}
          </DropdownMenuItem>
        )}
        {run.status === "completed" && can("forecast.run.publish") && (
          <DropdownMenuItem icon={<Send />} onSelect={() => actions.open("publish", run)}>
            {pick("Terbitkan sebagai acuan", "Publish as baseline")}
          </DropdownMenuItem>
        )}
        {(active || (can("forecast.run.archive") && run.status !== "archived" && run.id !== baselineId)) && <DropdownMenuSeparator />}
        {active && can("forecast.run.cancel") && (
          <DropdownMenuItem icon={<Ban />} destructive onSelect={() => actions.open("cancel", run)}>
            {pick("Batalkan proses", "Cancel run")}
          </DropdownMenuItem>
        )}
        {!active && run.status !== "archived" && run.id !== baselineId && can("forecast.run.archive") && (
          <DropdownMenuItem icon={<Archive />} onSelect={() => actions.open("archive", run)}>
            {pick("Arsipkan", "Archive")}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
