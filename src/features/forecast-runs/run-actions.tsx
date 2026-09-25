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

type Confirm = { kind: "cancel" | "publish" | "archive"; run: ForecastRun } | null;

const RUN_KEYS = [["runs"], ["run"], ["overview"], ["nav-counts"], ["notifications"], ["forecast-rows"], ["run-result"]] as const;

/** Mutations for a run, with consequence dialogs for high-impact actions. */
export function useRunActions(baselineId?: string | null) {
  const router = useRouter();
  const [confirm, setConfirm] = React.useState<Confirm>(null);
  const [reason, setReason] = React.useState("");

  const cancel = useApiMutation((ctx, v: { id: string; reason: string }) => cancelRun(ctx, v.id, v.reason), {
    invalidate: RUN_KEYS,
    success: (r) => `Cancelled ${r.id}`,
    successDescription: "Tidak ada hasil yang disimpan. Anda dapat menjalankan ulang nanti.",
    failure: "Proses tidak dapat dibatalkan.",
    onSuccess: () => setConfirm(null),
  });
  const retry = useApiMutation((ctx, id: string) => retryRun(ctx, id), {
    invalidate: RUN_KEYS,
    success: (r) => `Retrying ${r.id}`,
    successDescription: "Proses masuk antrean dan akan segera dimulai.",
    failure: "Proses tidak dapat dijalankan ulang.",
    onSuccess: (r) => {
      track("forecast_run_started", { retry: true });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });
  const publish = useApiMutation((ctx, v: { id: string; reason: string }) => publishRun(ctx, v.id, v.reason), {
    invalidate: RUN_KEYS,
    success: (r) => `Published ${r.id}`,
    successDescription: "Proses ini kini menjadi acuan perencanaan ruang kerja.",
    failure: "Proses tidak dapat diterbitkan.",
    onSuccess: () => setConfirm(null),
  });
  const archive = useApiMutation((ctx, id: string) => archiveRun(ctx, id), {
    invalidate: RUN_KEYS,
    success: (r) => `Archived ${r.id}`,
    failure: "Proses tidak dapat diarsipkan.",
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
          title={confirm.kind === "cancel" ? `Batalkan ${confirm.run.id}?` : confirm.kind === "publish" ? `Terbitkan ${confirm.run.id} sebagai acuan perencanaan?` : `Arsipkan ${confirm.run.id}?`}
          description={
            confirm.kind === "publish"
              ? "Menerbitkan akan menggantikan acuan yang dipakai Ringkasan, Perkiraan Permintaan, Perlu Ditinjau, dan rencana."
              : confirm.kind === "cancel"
                ? "Pemrosesan berhenti dan tidak ada hasil yang disimpan."
                : "Proses yang diarsipkan tetap dapat dilihat untuk referensi, tetapi tidak dapat diterbitkan."
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {confirm.kind === "cancel" ? "Tetap jalankan" : "Kembali"}
              </Button>
              {confirm.kind === "cancel" && (
                <Button variant="danger" loading={cancel.isPending} onClick={() => cancel.mutate({ id: confirm.run.id, reason })}>
                  Cancel forecast run
                </Button>
              )}
              {confirm.kind === "publish" && (
                <Button variant="primary" loading={publish.isPending} disabled={reason.trim().length < 5} onClick={() => publish.mutate({ id: confirm.run.id, reason })}>
                  Publish as baseline
                </Button>
              )}
              {confirm.kind === "archive" && (
                <Button variant="primary" loading={archive.isPending} onClick={() => archive.mutate(confirm.run.id)}>
                  Archive run
                </Button>
              )}
            </>
          }
        >
          <ConsequenceSummary
            rows={[
              { label: "Proses", value: `${confirm.run.name} (${confirm.run.id})` },
              { label: "Cakupan", value: `${scopeLabel(confirm.run)} · ${formatNumber(confirm.run.scope.skuCount)} SKU` },
              { label: "Rentang", value: `${confirm.run.horizonDays} hari · model ${confirm.run.modelVersion}` },
              ...(confirm.kind === "publish"
                ? [
                    { label: "Menggantikan", value: baselineId && baselineId !== confirm.run.id ? baselineId : "Belum ada acuan" },
                    { label: "Dampak", value: "Item yang perlu ditinjau dievaluasi ulang terhadap proses ini. Rencana yang terbuka tetap memakai acuannya sampai dibangun ulang.", emphasis: true },
                    { label: "Izin", value: "Menerbitkan proses perkiraan (Manajer atau Administrator)" },
                  ]
                : confirm.kind === "cancel"
                  ? [{ label: "Dimulai", value: formatDateTime(confirm.run.startedAt) }, { label: "Dampak", value: "Pekerjaan yang sudah berjalan akan dibuang.", emphasis: true }]
                  : [{ label: "Dampak", value: "Proses disembunyikan dari daftar bawaan dan tidak dapat menjadi acuan.", emphasis: true }]),
            ]}
          />
          {(confirm.kind === "publish" || confirm.kind === "cancel") && (
            <Field
              className="mt-4"
              label={confirm.kind === "publish" ? "Alasan menerbitkan" : "Alasan membatalkan"}
              htmlFor="run-reason"
              optional={confirm.kind === "cancel"}
              required={confirm.kind === "publish"}
              hint={confirm.kind === "publish" ? "Tercatat di riwayat aktivitas. Minimal 5 karakter." : "Tercatat di riwayat aktivitas."}
            >
              <Textarea id="run-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={confirm.kind === "publish" ? "mis. Sudah divalidasi dengan aktual kemarin" : "mis. Wilayah yang dipilih salah"} />
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
        <Button size="icon-sm" variant="ghost" aria-label={`Aksi untuk ${run.id}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem icon={<Eye />} onSelect={() => router.push(`/forecasting/runs/${run.id}`)}>
          {active ? "Lihat progres" : "Buka proses"}
        </DropdownMenuItem>
        {hasResults && (
          <DropdownMenuItem icon={<Eye />} onSelect={() => router.push(`/forecasting/explorer?run=${run.id}`)}>
            Lihat hasil
          </DropdownMenuItem>
        )}
        {can("forecast.run.create") && (
          <DropdownMenuItem icon={<Copy />} onSelect={() => router.push(`/forecasting/runs/new?from=${run.id}`)}>
            Duplikat pengaturan
          </DropdownMenuItem>
        )}
        {(run.status === "failed" || run.status === "cancelled") && can("forecast.run.create") && (
          <DropdownMenuItem icon={<RotateCcw />} onSelect={() => actions.retry.mutate(run.id)}>
            Jalankan ulang
          </DropdownMenuItem>
        )}
        {run.status === "completed" && can("forecast.run.publish") && (
          <DropdownMenuItem icon={<Send />} onSelect={() => actions.open("publish", run)}>
            Terbitkan sebagai acuan
          </DropdownMenuItem>
        )}
        {(active || (can("forecast.run.archive") && run.status !== "archived" && run.id !== baselineId)) && <DropdownMenuSeparator />}
        {active && can("forecast.run.cancel") && (
          <DropdownMenuItem icon={<Ban />} destructive onSelect={() => actions.open("cancel", run)}>
            Batalkan proses
          </DropdownMenuItem>
        )}
        {!active && run.status !== "archived" && run.id !== baselineId && can("forecast.run.archive") && (
          <DropdownMenuItem icon={<Archive />} onSelect={() => actions.open("archive", run)}>
            Arsipkan
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
