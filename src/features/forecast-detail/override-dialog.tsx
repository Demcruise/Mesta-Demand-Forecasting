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
import { pick, localized } from "@/lib/i18n";

export const OVERRIDE_REASONS: { value: OverrideReason; label: string }[] = localized([
  { value: "promotion_not_in_model", label: "Promosi belum ada di model" },
  { value: "supply_constraint", label: "Kendala pasokan atau alokasi" },
  { value: "new_listing", label: "Produk baru atau perubahan rangkaian" },
  { value: "known_event", label: "Acara lokal yang diketahui" },
  { value: "data_issue", label: "Masalah data pada riwayat" },
  { value: "other", label: "Lainnya (jelaskan di catatan)" },
], [
  { value: "promotion_not_in_model", label: "Promotion not in the model" },
  { value: "supply_constraint", label: "Supply or allocation constraint" },
  { value: "new_listing", label: "New listing or range change" },
  { value: "known_event", label: "Known local event" },
  { value: "data_issue", label: "Data issue in history" },
  { value: "other", label: "Other (explain in comment)" },
]);

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
  // Plain strings per locale — localized() is for module-scope trees, not values.
  const commentError = touched && comment.trim().length < 10 ? pick("Jelaskan perubahan manual minimal 10 karakter.", "Explain the override in at least 10 characters.") : null;
  const valueError = touched && !valid ? pick("Masukkan perkiraan baru.", "Enter the new forecast.") : touched && valid && newUnits === originalUnits ? pick("Nilai baru sama dengan perkiraan saat ini.", "The new value is the same as the current forecast.") : null;

  const mutation = useApiMutation((c, _v: void) => applyOverride(c, { runId, productIds, newUnits, reason, evidence, comment }), {
    invalidate: [["forecast-rows"], ["forecast-detail"], ["run-result"], ["overview"], ["approvals"], ["nav-counts"], ["notifications"]],
    success: (o) => (o.status === "applied" ? pick("Perubahan diterapkan", "Override applied") : pick("Perubahan dikirim untuk persetujuan", "Override submitted for approval")),
    successDescription: (o) =>
      o.status === "applied"
        ? pick(`${label}: ${formatNumber(o.originalUnits)} → ${formatNumber(o.newUnits)} unit.`, `${label}: ${formatNumber(o.originalUnits)} → ${formatNumber(o.newUnits)} units.`)
        : pick("Acuan perencanaan berubah setelah Manajer menyetujuinya.", "The planning baseline changes once a Manager approves it."),
    failure: pick("Perubahan manual tidak tersimpan.", "The override was not saved."),
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
        title={step === "edit" ? pick(`Ubah Perkiraan · ${label}`, `Override forecast · ${label}`) : preview?.needsApproval ? pick("Kirim perubahan untuk persetujuan?", "Submit override for approval?") : pick("Terapkan perubahan ini?", "Apply this override?")}
        description={step === "edit" ? pick(`Perkiraan ${horizonDays} hari untuk ${productIds.length} SKU. Perubahan tercatat atas nama Anda di riwayat aktivitas.`, `${horizonDays}-day forecast for ${pluralize(productIds.length, "SKU")}. Overrides are attributed to you and recorded in the audit log.`) : undefined}
        footer={
          !can("forecast.override") ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {pick("Tutup", "Close")}
            </Button>
          ) : step === "edit" ? (
            <>
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                {pick("Batal", "Cancel")}
              </Button>
              <Button variant="primary" onClick={toConfirm}>
                {pick("Tinjau perubahan", "Review override")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setStep("edit")}>
                {pick("Kembali mengubah", "Back to edit")}
              </Button>
              <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
                {preview?.needsApproval ? pick("Kirim untuk persetujuan", "Submit for approval") : pick("Terapkan Perubahan", "Apply override")}
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
                <p className="caption">{pick("Perkiraan saat ini", "Original forecast")}</p>
                <p className="numeric-md">{formatNumber(originalUnits)}</p>
              </div>
              <div>
                <p className="caption">{pick("Perkiraan baru", "New forecast")}</p>
                <p className="numeric-md">{valid ? formatNumber(newUnits) : "—"}</p>
              </div>
              <div>
                <p className="caption">{pick("Perubahan", "Change")}</p>
                <p className="numeric-md">{valid ? <><SignedPercent percent={preview?.pct ?? 0} /> ({formatDeltaNumber(preview?.delta ?? 0)})</> : "—"}</p>
              </div>
            </div>
            <Field
              label={mode === "percent" ? pick("Perubahan dalam persen", "Change in percent") : pick("Perkiraan baru dalam unit", "New forecast in units")}
              htmlFor="ovr-value"
              required
              error={valueError}
              hint={mode === "percent" ? pick("Gunakan angka negatif untuk menurunkan, mis. −8.", "Use a negative number to reduce, e.g. −8.") : pick(`Total selama ${horizonDays} hari untuk SKU yang dipilih.`, `Total over ${horizonDays} days for the selected SKUs.`)}
              aside={
                <Segmented
                  size="sm"
                  aria-label={pick("Masukkan perubahan sebagai", "Enter override as")}
                  value={mode}
                  onValueChange={(m) => {
                    setMode(m);
                    setValue("");
                  }}
                  options={[
                    { value: "percent", label: "%" },
                    { value: "units", label: pick("Unit", "Units") },
                  ]}
                />
              }
            >
              <Input id="ovr-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace("−", "-"))} placeholder={mode === "percent" ? "e.g. 6" : formatNumber(originalUnits)} aria-invalid={!!valueError} autoFocus />
            </Field>
            <Field label={pick("Alasan", "Reason")} htmlFor="ovr-reason" required>
              <Select id="ovr-reason" value={reason} onValueChange={(v) => setReason(v as OverrideReason)} options={OVERRIDE_REASONS} />
            </Field>
            <Field label={pick("Bukti", "Evidence")} htmlFor="ovr-evidence" optional hint={pick("Sebutkan dokumen, ringkasan promosi, atau tiket terkait.", "Reference a document, promotion brief or ticket.")}>
              <Input id="ovr-evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder={pick("mis. Brief promosi dagang TPB-1142", "e.g. Trade promotion brief TPB-1142")} />
            </Field>
            <Field label={pick("Catatan", "Comment")} htmlFor="ovr-comment" required error={commentError} hint={pick("Hal yang belum diketahui model, dengan bahasa sederhana.", "What the model does not know, in plain language.")}>
              <Textarea id="ovr-comment" value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={!!commentError} rows={3} />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ConsequenceSummary
              rows={[
                { label: pick("Cakupan", "Scope"), value: `${label} · ${pluralize(productIds.length, "SKU")}` },
                { label: pick("Perkiraan saat ini", "Original forecast"), value: pick(`${formatNumber(originalUnits)} unit`, `${formatNumber(originalUnits)} units`) },
                { label: pick("Perkiraan baru", "New forecast"), value: pick(`${formatNumber(newUnits)} unit`, `${formatNumber(newUnits)} units`), emphasis: true },
                { label: pick("Perubahan", "Change"), value: pick(`${formatDeltaPercent(preview?.pct ?? 0)} (${formatDeltaNumber(preview?.delta ?? 0)} unit)`, `${formatDeltaPercent(preview?.pct ?? 0)} (${formatDeltaNumber(preview?.delta ?? 0)} units)`), emphasis: true },
                { label: pick("Alasan", "Reason"), value: OVERRIDE_REASONS.find((r) => r.value === reason)?.label },
                { label: pick("Catatan", "Comment"), value: comment },
                { label: pick("Persetujuan", "Approval"), value: preview?.needsApproval ? pick(`Diperlukan. ${preview.policy}`, `Required. ${preview.policy}`) : pick("Tidak diperlukan menurut kebijakan saat ini.", "Not required under the current policy.") },
              ]}
            />
            <InlineAlert tone={preview?.needsApproval ? "info" : "warning"} title={preview?.needsApproval ? pick("Acuan tidak berubah sampai Manajer menyetujuinya.", "The baseline does not change until a Manager approves.") : pick("Perubahan ini langsung memengaruhi acuan perencanaan.", "This change will affect the planning baseline immediately.")} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
