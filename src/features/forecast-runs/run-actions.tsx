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
    successDescription: "No results were written. You can retry the run later.",
    failure: "The run was not cancelled.",
    onSuccess: () => setConfirm(null),
  });
  const retry = useApiMutation((ctx, id: string) => retryRun(ctx, id), {
    invalidate: RUN_KEYS,
    success: (r) => `Retrying ${r.id}`,
    successDescription: "The run is queued and will start shortly.",
    failure: "The run could not be retried.",
    onSuccess: (r) => {
      track("forecast_run_started", { retry: true });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });
  const publish = useApiMutation((ctx, v: { id: string; reason: string }) => publishRun(ctx, v.id, v.reason), {
    invalidate: RUN_KEYS,
    success: (r) => `Published ${r.id}`,
    successDescription: "It is now the planning baseline for this workspace.",
    failure: "The run was not published.",
    onSuccess: () => setConfirm(null),
  });
  const archive = useApiMutation((ctx, id: string) => archiveRun(ctx, id), {
    invalidate: RUN_KEYS,
    success: (r) => `Archived ${r.id}`,
    failure: "The run was not archived.",
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
          title={confirm.kind === "cancel" ? `Cancel ${confirm.run.id}?` : confirm.kind === "publish" ? `Publish ${confirm.run.id} as the planning baseline?` : `Archive ${confirm.run.id}?`}
          description={
            confirm.kind === "publish"
              ? "Publishing replaces the current baseline used by the overview, explorer, exceptions and plans."
              : confirm.kind === "cancel"
                ? "Processing stops and no results are written."
                : "Archived runs stay available for reference but cannot be published."
          }
          footer={
            <>
              <Button variant="ghost" onClick={() => setConfirm(null)}>
                {confirm.kind === "cancel" ? "Keep running" : "Back"}
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
              { label: "Run", value: `${confirm.run.name} (${confirm.run.id})` },
              { label: "Scope", value: `${scopeLabel(confirm.run)} · ${formatNumber(confirm.run.scope.skuCount)} SKUs` },
              { label: "Horizon", value: `${confirm.run.horizonDays} days · model ${confirm.run.modelVersion}` },
              ...(confirm.kind === "publish"
                ? [
                    { label: "Replaces", value: baselineId && baselineId !== confirm.run.id ? baselineId : "No current baseline" },
                    { label: "Consequence", value: "Exceptions are re-evaluated against this run. Open plans keep their current baseline until rebuilt.", emphasis: true },
                    { label: "Permission", value: "Publish forecast runs (Manager or Administrator)" },
                  ]
                : confirm.kind === "cancel"
                  ? [{ label: "Started", value: formatDateTime(confirm.run.startedAt) }, { label: "Consequence", value: "Work done so far is discarded.", emphasis: true }]
                  : [{ label: "Consequence", value: "The run is hidden from default lists and cannot become a baseline.", emphasis: true }]),
            ]}
          />
          {(confirm.kind === "publish" || confirm.kind === "cancel") && (
            <Field
              className="mt-4"
              label={confirm.kind === "publish" ? "Reason for publishing" : "Reason for cancelling"}
              htmlFor="run-reason"
              optional={confirm.kind === "cancel"}
              required={confirm.kind === "publish"}
              hint={confirm.kind === "publish" ? "Recorded in the audit log. At least 5 characters." : "Recorded in the audit log."}
            >
              <Textarea id="run-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={confirm.kind === "publish" ? "e.g. Validated against yesterday's actuals" : "e.g. Wrong region selected"} />
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
        <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${run.id}`} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()}>
        <DropdownMenuItem icon={<Eye />} onSelect={() => router.push(`/forecasting/runs/${run.id}`)}>
          {active ? "View progress" : "Open run"}
        </DropdownMenuItem>
        {hasResults && (
          <DropdownMenuItem icon={<Eye />} onSelect={() => router.push(`/forecasting/explorer?run=${run.id}`)}>
            View results
          </DropdownMenuItem>
        )}
        {can("forecast.run.create") && (
          <DropdownMenuItem icon={<Copy />} onSelect={() => router.push(`/forecasting/runs/new?from=${run.id}`)}>
            Duplicate configuration
          </DropdownMenuItem>
        )}
        {(run.status === "failed" || run.status === "cancelled") && can("forecast.run.create") && (
          <DropdownMenuItem icon={<RotateCcw />} onSelect={() => actions.retry.mutate(run.id)}>
            Retry run
          </DropdownMenuItem>
        )}
        {run.status === "completed" && can("forecast.run.publish") && (
          <DropdownMenuItem icon={<Send />} onSelect={() => actions.open("publish", run)}>
            Publish as baseline
          </DropdownMenuItem>
        )}
        {(active || (can("forecast.run.archive") && run.status !== "archived" && run.id !== baselineId)) && <DropdownMenuSeparator />}
        {active && can("forecast.run.cancel") && (
          <DropdownMenuItem icon={<Ban />} destructive onSelect={() => actions.open("cancel", run)}>
            Cancel run
          </DropdownMenuItem>
        )}
        {!active && run.status !== "archived" && run.id !== baselineId && can("forecast.run.archive") && (
          <DropdownMenuItem icon={<Archive />} onSelect={() => actions.open("archive", run)}>
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
