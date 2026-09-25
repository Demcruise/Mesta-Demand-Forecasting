"use client";

import * as React from "react";
import type { NotificationCategory, NotificationChannel, NotificationRules, Severity } from "@/types/domain";
import { getNotificationRules, updateNotificationRules } from "@/lib/api/platform";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { Button } from "@/components/ui/button";
import { Checkbox, SwitchField } from "@/components/ui/controls";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { Panel } from "@/components/page/page";
import { ErrorState, TableSkeleton } from "@/components/feedback/states";

const ROWS: { key: NotificationCategory; label: string; description: string; locked?: boolean }[] = [
  { key: "approval_requested", label: "Approval requested", description: "A request needs your decision. Always shown in the app.", locked: true },
  { key: "approval_completed", label: "Approval completed", description: "A request you made or follow was decided." },
  { key: "forecast_completed", label: "Forecast completed", description: "A run finished processing." },
  { key: "forecast_failed", label: "Forecast failed", description: "A run stopped with an error." },
  { key: "exception_opened", label: "Exception opened", description: "New exceptions above your minimum severity." },
  { key: "data_quality", label: "Data quality issue", description: "A blocking or warning data check failed." },
  { key: "data_freshness", label: "Data freshness", description: "A source is delayed or failing." },
  { key: "scenario_completed", label: "Scenario simulated", description: "A scenario simulation finished." },
  { key: "model_issue", label: "Model issue", description: "Drift or degradation on a production model." },
];

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: "in_app", label: "In app" },
  { key: "email", label: "Email" },
];

/** PLAT-006: per-user delivery rules — channel per event, severity floor, quiet hours and digest. */
export function NotificationRulesSection() {
  const { session } = useSession();
  const q = useApiQuery(["notification-rules"], getNotificationRules);
  const [draft, setDraft] = React.useState<NotificationRules | null>(null);
  React.useEffect(() => {
    if (q.data) setDraft(structuredClone(q.data));
  }, [q.data]);
  const save = useApiMutation((c, v: NotificationRules) => updateNotificationRules(c, v), {
    invalidate: [["notification-rules"], ["notifications"]],
    success: "Notification rules saved",
    failure: "Notification rules were not saved.",
  });

  if (q.isPending || !draft) return <Panel><TableSkeleton rows={6} columns={3} /></Panel>;
  if (q.isError) return <ErrorState what="Notification rules could not be loaded." error={q.error} onRetry={() => q.refetch()} />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(q.data);
  const toggle = (cat: NotificationCategory, ch: NotificationChannel, on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const current = d.channels[cat] ?? [];
      return { ...d, channels: { ...d.channels, [cat]: on ? [...current, ch] : current.filter((x) => x !== ch) } };
    });

  return (
    <Panel
      title="Notifications"
      description={`Where and when Mesta notifies you (${session.email}). These rules apply only to you.`}
      footer={
        <>
          <span className="caption">{dirty ? "Unsaved changes" : "No unsaved changes"}</span>
          <div className="flex gap-2">
            <Button variant="ghost" disabled={!dirty} onClick={() => setDraft(structuredClone(q.data))}>
              Discard changes
            </Button>
            <Button variant="primary" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate(draft)}>
              Save rules
            </Button>
          </div>
        </>
      }
    >
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full min-w-[32rem] border-collapse text-[0.8125rem]">
          <caption className="sr-only">Delivery channels by event</caption>
          <thead className="bg-subtle">
            <tr>
              <th scope="col" className="border-b border-border px-3 py-2 text-left text-xs font-semibold text-fg-secondary">
                Event
              </th>
              {CHANNELS.map((c) => (
                <th key={c.key} scope="col" className="w-24 border-b border-border px-3 py-2 text-center text-xs font-semibold text-fg-secondary">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.key} className="border-b border-border-subtle last:border-b-0">
                <th scope="row" className="px-3 py-2.5 text-left font-normal">
                  <span className="block font-semibold text-fg">{r.label}</span>
                  <span className="block caption">{r.description}</span>
                </th>
                {CHANNELS.map((c) => {
                  const locked = r.locked && c.key === "in_app";
                  return (
                    <td key={c.key} className="px-3 py-2.5 text-center">
                      <Checkbox
                        aria-label={`${r.label} by ${c.label.toLowerCase()}`}
                        checked={locked || (draft.channels[r.key] ?? []).includes(c.key)}
                        disabled={locked}
                        onCheckedChange={(v) => toggle(r.key, c.key, v === true)}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Minimum exception severity" htmlFor="nr-sev" hint="Exceptions below this level do not notify you.">
          <Select
            id="nr-sev"
            value={draft.minExceptionSeverity}
            onValueChange={(v) => setDraft({ ...draft, minExceptionSeverity: v as Severity })}
            options={[
              { value: "info", label: "Info and above" },
              { value: "warning", label: "Warning and above" },
              { value: "critical", label: "Critical only" },
            ]}
          />
        </Field>
        <Field label="Email digest" htmlFor="nr-digest" hint="Groups non-urgent emails into one message.">
          <Select
            id="nr-digest"
            value={draft.digest}
            onValueChange={(v) => setDraft({ ...draft, digest: v as NotificationRules["digest"] })}
            options={[
              { value: "off", label: "Send immediately" },
              { value: "daily", label: "Daily at 08:00" },
              { value: "weekly", label: "Weekly on Monday" },
            ]}
          />
        </Field>
      </div>
      <div className="mt-2 border-t border-border-subtle">
        <SwitchField id="nr-quiet" label="Quiet hours" description="Hold email notifications during these hours. Failed runs and approval requests still arrive in the app." checked={draft.quietHours.enabled} onCheckedChange={(v) => setDraft({ ...draft, quietHours: { ...draft.quietHours, enabled: v } })} />
        {draft.quietHours.enabled && (
          <div className="grid max-w-sm grid-cols-2 gap-3 pb-2">
            <Field label="From" htmlFor="nr-from">
              <Input id="nr-from" type="time" value={draft.quietHours.start} onChange={(e) => setDraft({ ...draft, quietHours: { ...draft.quietHours, start: e.target.value } })} />
            </Field>
            <Field label="Until" htmlFor="nr-to">
              <Input id="nr-to" type="time" value={draft.quietHours.end} onChange={(e) => setDraft({ ...draft, quietHours: { ...draft.quietHours, end: e.target.value } })} />
            </Field>
          </div>
        )}
      </div>
    </Panel>
  );
}
