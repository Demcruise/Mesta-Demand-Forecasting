"use client";

import * as React from "react";
import type { OverrideReason } from "@/types/domain";
import { applyOverride, previewOverride } from "@/lib/api/forecasting";
import { useApiMutation } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDeltaNumber, formatDeltaPercent, formatNumber, pluralize } from "@/lib/format";
import { SignedPercent } from "@/components/forecasting/metrics";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/controls";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { ConsequenceSummary } from "@/components/governance/audit";

export const OVERRIDE_REASONS: { value: OverrideReason; label: string }[] = [
  { value: "promotion_not_in_model", label: "Promosi belum ada di model" },
  { value: "supply_constraint", label: "Kendala pasokan atau alokasi" },
  { value: "new_listing", label: "Produk baru atau perubahan rangkaian" },
  { value: "known_event", label: "Acara lokal yang diketahui" },
  { value: "data_issue", label: "Masalah data pada riwayat" },
  { value: "other", label: "Lainnya (jelaskan di catatan)" },
];

/**
 * OVERRIDE-001: attributable, explained changes to a forecast. Captures previous and
 * new value, user, time, reason and evidence; routes to approval when policy requires.
 */
export function OverrideDialog({
  open,
  onOpenChange,
  runId,
  productIds,
  originalUnits,
  label,
  horizonDays,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  productIds: string[];
  originalUnits: number;
  label: string;
  horizonDays: number;
  onDone?: () => void;
}) {
  const { ctx, can } = useSession();
  const [mode, setMode] = React.useState<"units" | "percent">("percent");
  const [value, setValue] = React.useState("");
  const [reason, setReason] = React.useState<OverrideReason>("promotion_not_in_model");
  const [evidence, setEvidence] = React.useState("");
  const [comment, setComment] = React.useState("");
  const [step, setStep] = React.useState<"edit" | "confirm">("edit");
  const [touched, setTouched] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setMode("percent");
      setValue("");
      setReason("promotion_not_in_model");
      setEvidence("");
      setComment("");
      setStep("edit");
      setTouched(false);
      track("override_started", { skus: productIds.length });
    }
  }, [open, productIds.length]);

  const parsed = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(parsed);
  const newUnits = valid ? Math.max(0, Math.round(mode === "units" ? parsed : originalUnits * (1 + parsed / 100))) : originalUnits;
  const preview = valid ? previewOverride(ctx, { runId, productIds, newUnits }) : null;
  const commentError = touched && comment.trim().length < 10 ? "Jelaskan perubahan manual minimal 10 karakter." : null;
  const valueError = touched && !valid ? "Masukkan perkiraan baru." : touched && valid && newUnits === originalUnits ? "Nilai baru sama dengan perkiraan saat ini." : null;

  const mutation = useApiMutation((c, _v: void) => applyOverride(c, { runId, productIds, newUnits, reason, evidence, comment }), {
    invalidate: [["forecast-rows"], ["forecast-detail"], ["run-result"], ["overview"], ["approvals"], ["nav-counts"], ["notifications"]],
    success: (o) => (o.status === "applied" ? "Perubahan diterapkan" : "Perubahan dikirim untuk persetujuan"),
    successDescription: (o) =>
      o.status === "applied" ? `${label}: ${formatNumber(o.originalUnits)} → ${formatNumber(o.newUnits)} unit.` : "Acuan perencanaan berubah setelah Manajer menyetujuinya.",
    failure: "Perubahan manual tidak tersimpan.",
    onSuccess: (o) => {
      track("override_applied", { pendingApproval: o.status !== "applied" });
      onOpenChange(false);
      onDone?.();
    },
  });

  const toConfirm = () => {
    setTouched(true);
    if (!valid || newUnits === originalUnits || comment.trim().length < 10) return;
    setStep("confirm");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="md"
        title={step === "edit" ? `Ubah Perkiraan · ${label}` : preview?.needsApproval ? "Kirim perubahan untuk persetujuan?" : "Terapkan perubahan ini?"}
        description={step === "edit" ? `${horizonDays}-day forecast for ${pluralize(productIds.length, "SKU")}. Overrides are attributed to you and recorded in the audit log.` : undefined}
        footer={
          !can("forecast.override") ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Close
            </Button>
          ) : step === "edit" ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={toConfirm}>
                Review override
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("edit")}>
                Back to edit
              </Button>
              <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
                {preview?.needsApproval ? "Kirim untuk persetujuan" : "Terapkan Perubahan"}
              </Button>
            </>
          )
        }
      >
        {!can("forecast.override") ? (
          <PermissionNotice permission="forecast.override" />
        ) : step === "edit" ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-subtle p-3">
              <div>
                <p className="caption">Perkiraan saat ini</p>
                <p className="numeric-md">{formatNumber(originalUnits)}</p>
              </div>
              <div>
                <p className="caption">Perkiraan baru</p>
                <p className="numeric-md">{valid ? formatNumber(newUnits) : "—"}</p>
              </div>
              <div>
                <p className="caption">Perubahan</p>
                <p className="numeric-md">{valid ? <><SignedPercent percent={preview?.pct ?? 0} /> ({formatDeltaNumber(preview?.delta ?? 0)})</> : "—"}</p>
              </div>
            </div>
            <Field
              label={mode === "percent" ? "Perubahan dalam persen" : "Perkiraan baru dalam unit"}
              htmlFor="ovr-value"
              required
              error={valueError}
              hint={mode === "percent" ? "Gunakan angka negatif untuk menurunkan, mis. −8." : `Total selama ${horizonDays} hari untuk SKU yang dipilih.`}
              aside={
                <Segmented
                  size="sm"
                  aria-label="Masukkan perubahan sebagai"
                  value={mode}
                  onValueChange={(m) => {
                    setMode(m);
                    setValue("");
                  }}
                  options={[
                    { value: "percent", label: "%" },
                    { value: "units", label: "Unit" },
                  ]}
                />
              }
            >
              <Input id="ovr-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace("−", "-"))} placeholder={mode === "percent" ? "e.g. 6" : formatNumber(originalUnits)} aria-invalid={!!valueError} autoFocus />
            </Field>
            <Field label="Alasan" htmlFor="ovr-reason" required>
              <Select id="ovr-reason" value={reason} onValueChange={(v) => setReason(v as OverrideReason)} options={OVERRIDE_REASONS} />
            </Field>
            <Field label="Bukti" htmlFor="ovr-evidence" optional hint="Sebutkan dokumen, ringkasan promosi, atau tiket terkait.">
              <Input id="ovr-evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="e.g. Trade promotion brief TPB-1142" />
            </Field>
            <Field label="Catatan" htmlFor="ovr-comment" required error={commentError} hint="Hal yang belum diketahui model, dengan bahasa sederhana.">
              <Textarea id="ovr-comment" value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={!!commentError} rows={3} />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ConsequenceSummary
              rows={[
                { label: "Cakupan", value: `${label} · ${pluralize(productIds.length, "SKU")}` },
                { label: "Perkiraan saat ini", value: `${formatNumber(originalUnits)} unit` },
                { label: "Perkiraan baru", value: `${formatNumber(newUnits)} unit`, emphasis: true },
                { label: "Perubahan", value: `${formatDeltaPercent(preview?.pct ?? 0)} (${formatDeltaNumber(preview?.delta ?? 0)} unit)`, emphasis: true },
                { label: "Alasan", value: OVERRIDE_REASONS.find((r) => r.value === reason)?.label },
                { label: "Catatan", value: comment },
                { label: "Persetujuan", value: preview?.needsApproval ? `Diperlukan. ${preview.policy}` : "Tidak diperlukan menurut kebijakan saat ini." },
              ]}
            />
            <InlineAlert tone={preview?.needsApproval ? "info" : "warning"} title={preview?.needsApproval ? "Acuan tidak berubah sampai Manajer menyetujuinya." : "Perubahan ini langsung memengaruhi acuan perencanaan."} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
