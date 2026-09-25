"use client";

import * as React from "react";
import type { OverrideReason } from "@/types/domain";
import { applyOverride, previewOverride } from "@/lib/api/forecasting";
import { useApiMutation } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { formatDeltaNumber, formatDeltaPercent, formatNumber, pluralize } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Segmented } from "@/components/ui/controls";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/overlay";
import { InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { ConsequenceSummary } from "@/components/governance/audit";

export const OVERRIDE_REASONS: { value: OverrideReason; label: string }[] = [
  { value: "promotion_not_in_model", label: "Promotion not in the model" },
  { value: "supply_constraint", label: "Supply or allocation constraint" },
  { value: "new_listing", label: "New listing or range change" },
  { value: "known_event", label: "Known local event" },
  { value: "data_issue", label: "Data issue in history" },
  { value: "other", label: "Other (explain in comment)" },
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
  const commentError = touched && comment.trim().length < 10 ? "Explain the override in at least 10 characters." : null;
  const valueError = touched && !valid ? "Enter the new forecast." : touched && valid && newUnits === originalUnits ? "The new value is the same as the current forecast." : null;

  const mutation = useApiMutation((c, _v: void) => applyOverride(c, { runId, productIds, newUnits, reason, evidence, comment }), {
    invalidate: [["forecast-rows"], ["forecast-detail"], ["run-result"], ["overview"], ["approvals"], ["nav-counts"], ["notifications"]],
    success: (o) => (o.status === "applied" ? "Override applied" : "Override submitted for approval"),
    successDescription: (o) =>
      o.status === "applied" ? `${label}: ${formatNumber(o.originalUnits)} → ${formatNumber(o.newUnits)} units.` : "The planning baseline changes once a Manager approves it.",
    failure: "The override was not saved.",
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
        title={step === "edit" ? `Override forecast · ${label}` : preview?.needsApproval ? "Submit override for approval?" : "Apply this override?"}
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
                {preview?.needsApproval ? "Submit for approval" : "Apply override"}
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
                <p className="caption">Original forecast</p>
                <p className="numeric-md">{formatNumber(originalUnits)}</p>
              </div>
              <div>
                <p className="caption">New forecast</p>
                <p className="numeric-md">{valid ? formatNumber(newUnits) : "—"}</p>
              </div>
              <div>
                <p className="caption">Change</p>
                <p className="numeric-md">{valid ? `${formatDeltaPercent(preview?.pct ?? 0)} (${formatDeltaNumber(preview?.delta ?? 0)})` : "—"}</p>
              </div>
            </div>
            <Field
              label={mode === "percent" ? "Change in percent" : "New forecast in units"}
              htmlFor="ovr-value"
              required
              error={valueError}
              hint={mode === "percent" ? "Use a negative number to reduce, e.g. −8." : `Total over ${horizonDays} days for the selected SKUs.`}
              aside={
                <Segmented
                  size="sm"
                  aria-label="Enter override as"
                  value={mode}
                  onValueChange={(m) => {
                    setMode(m);
                    setValue("");
                  }}
                  options={[
                    { value: "percent", label: "%" },
                    { value: "units", label: "Units" },
                  ]}
                />
              }
            >
              <Input id="ovr-value" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace("−", "-"))} placeholder={mode === "percent" ? "e.g. 6" : formatNumber(originalUnits)} aria-invalid={!!valueError} autoFocus />
            </Field>
            <Field label="Reason" htmlFor="ovr-reason" required>
              <Select id="ovr-reason" value={reason} onValueChange={(v) => setReason(v as OverrideReason)} options={OVERRIDE_REASONS} />
            </Field>
            <Field label="Evidence" htmlFor="ovr-evidence" optional hint="Reference a document, promotion brief or ticket.">
              <Input id="ovr-evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="e.g. Trade promotion brief TPB-1142" />
            </Field>
            <Field label="Comment" htmlFor="ovr-comment" required error={commentError} hint="What the model does not know, in plain language.">
              <Textarea id="ovr-comment" value={comment} onChange={(e) => setComment(e.target.value)} aria-invalid={!!commentError} rows={3} />
            </Field>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <ConsequenceSummary
              rows={[
                { label: "Scope", value: `${label} · ${pluralize(productIds.length, "SKU")}` },
                { label: "Original forecast", value: `${formatNumber(originalUnits)} units` },
                { label: "New forecast", value: `${formatNumber(newUnits)} units`, emphasis: true },
                { label: "Change", value: `${formatDeltaPercent(preview?.pct ?? 0)} (${formatDeltaNumber(preview?.delta ?? 0)} units)`, emphasis: true },
                { label: "Reason", value: OVERRIDE_REASONS.find((r) => r.value === reason)?.label },
                { label: "Comment", value: comment },
                { label: "Approval", value: preview?.needsApproval ? `Required. ${preview.policy}` : "Not required under the current policy." },
              ]}
            />
            <InlineAlert tone={preview?.needsApproval ? "info" : "warning"} title={preview?.needsApproval ? "The baseline does not change until a Manager approves." : "This change will affect the planning baseline immediately."} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
