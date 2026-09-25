"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { CalendarClock, MoreHorizontal, Pause, Pencil, Play, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { ForecastSchedule } from "@/types/domain";
import { listModelOptions } from "@/lib/api/models";
import { deleteSchedule, listSchedules, runScheduleNow, saveSchedule, setScheduleEnabled, type ScheduleInput, type ScheduleRow } from "@/lib/api/platform";
import { useApiMutation, useApiQuery } from "@/hooks/use-api";
import { useSession } from "@/lib/session-context";
import { CATEGORIES, REGIONS } from "@/lib/mock/catalog";
import { WEEKDAYS } from "@/lib/mock/platform";
import { formatDateTime, formatRelative } from "@/lib/format";
import { track } from "@/lib/telemetry";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { MultiSelect } from "@/components/ui/multi-select";
import { SwitchField } from "@/components/ui/controls";
import { Dialog, DialogContent, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/overlay";
import { PageContainer, PageHeader } from "@/components/page/page";
import { DataTable, type ColumnMeta } from "@/components/tables/data-table";
import { StatusBadge, Tag } from "@/components/feedback/status";
import { EmptyState, InlineAlert, PermissionNotice } from "@/components/feedback/states";
import { UserIdentity } from "@/components/entities/identity";
import { TypedConfirmDialog } from "@/components/governance/typed-confirm";

export function cadenceLabel(s: Pick<ForecastSchedule, "cadence" | "time">) {
  return s.cadence.type === "daily" ? `Every day at ${s.time}` : `Every ${WEEKDAYS[s.cadence.weekday]} at ${s.time}`;
}

const EMPTY: ScheduleInput = { name: "", cadence: { type: "daily" }, time: "05:30", categories: [], regions: [], horizonDays: 28, modelId: null, autoPublish: false, enabled: true };

/** PLAT-007: scheduled forecast workflows. Scheduled runs are validated and audited like manual runs. */
export function SchedulesView() {
  const router = useRouter();
  const { can } = useSession();
  const manage = can("forecast.run.create");
  const q = useApiQuery(["schedules"], listSchedules, { refetchInterval: 30_000 });
  const models = useApiQuery(["model-options"], listModelOptions);
  const [editing, setEditing] = React.useState<{ id: string | null; input: ScheduleInput } | null>(null);
  const [deleting, setDeleting] = React.useState<ScheduleRow | null>(null);
  const inv = [["schedules"], ["runs"], ["audit"]] as const;

  const save = useApiMutation((c, v: { id: string | null; input: ScheduleInput }) => saveSchedule(c, v.id, v.input), {
    invalidate: inv,
    success: (s) => `Schedule “${s.name}” saved`,
    successDescription: (s) => `Next run ${s.enabled ? "as scheduled" : "paused"}.`,
    failure: "The schedule was not saved.",
    onSuccess: () => setEditing(null),
  });
  const toggle = useApiMutation((c, v: { id: string; enabled: boolean }) => setScheduleEnabled(c, v.id, v.enabled), { invalidate: inv, success: (s) => `${s.name} ${s.enabled ? "resumed" : "paused"}`, failure: "The schedule was not changed." });
  const remove = useApiMutation((c, id: string) => deleteSchedule(c, id), { invalidate: inv, success: "Schedule deleted", failure: "The schedule was not deleted.", onSuccess: () => setDeleting(null) });
  const runNow = useApiMutation((c, id: string) => runScheduleNow(c, id), {
    invalidate: inv,
    success: (r) => `Started ${r.id}`,
    failure: "The run did not start.",
    onSuccess: (r) => {
      track("forecast_run_started", { source: "schedule" });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });

  const columns = React.useMemo<ColumnDef<ScheduleRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Schedule",
        meta: { width: "minmax(240px, 2fr)", pinned: true, label: "Schedule" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.name}</span>
            <span className="truncate text-xs text-fg-tertiary">
              {row.original.categories.length ? row.original.categories.join(", ") : "All categories"} · {row.original.regions.length ? row.original.regions.join(", ") : "All regions"} · {row.original.horizonDays} d
            </span>
          </span>
        ),
      },
      { id: "cadence", header: "Cadence", meta: { width: "minmax(170px, 1fr)" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{cadenceLabel(row.original)}</span> },
      {
        id: "next",
        header: "Next run",
        meta: { width: "170px" } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.nextRunAt ? <span className="tabular" title={formatDateTime(row.original.nextRunAt)}>{formatRelative(row.original.nextRunAt)}</span> : <span className="text-fg-tertiary">Paused</span>),
      },
      {
        id: "last",
        header: "Last run",
        meta: { width: "190px", hideBelow: "lg" } satisfies ColumnMeta,
        cell: ({ row }) =>
          row.original.lastRunId && row.original.lastRunStatus ? (
            <span className="flex items-center gap-2">
              <span className="mono-id">{row.original.lastRunId}</span>
              <StatusBadge status={row.original.lastRunStatus as never} size="sm" />
            </span>
          ) : row.original.lastRunAt ? (
            <span className="text-xs text-fg-secondary">{formatRelative(row.original.lastRunAt)}</span>
          ) : (
            <span className="text-fg-tertiary">Never</span>
          ),
      },
      {
        id: "publish",
        header: "Publication",
        meta: { width: "140px", hideBelow: "md", description: "Automatic publication replaces the planning baseline without review." } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.autoPublish ? <Tag tone="warning">Automatic</Tag> : <Tag>Manual review</Tag>),
      },
      { id: "owner", header: "Owner", meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      {
        id: "status",
        header: "Status",
        meta: { width: "110px" } satisfies ColumnMeta,
        cell: ({ row }) => <StatusBadge status={row.original.enabled ? "active" : "paused"} label={row.original.enabled ? "Enabled" : "Paused"} size="sm" />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        meta: { width: "52px", pinned: true, label: "Actions" } satisfies ColumnMeta,
        cell: ({ row }) => {
          const s = row.original;
          if (!manage) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={`Actions for ${s.name}`}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem icon={<Play />} onSelect={() => runNow.mutate(s.id)}>
                  Run now
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing({ id: s.id, input: { name: s.name, cadence: s.cadence, time: s.time, categories: s.categories, regions: s.regions, horizonDays: s.horizonDays, modelId: s.modelId, autoPublish: s.autoPublish, enabled: s.enabled } })}>
                  Edit schedule
                </DropdownMenuItem>
                <DropdownMenuItem icon={s.enabled ? <Pause /> : <Play />} onSelect={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}>
                  {s.enabled ? "Pause" : "Resume"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setDeleting(s)}>
                  Delete schedule
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [manage],
  );

  const e = editing?.input;
  const set = (patch: Partial<ScheduleInput>) => setEditing((prev) => (prev ? { ...prev, input: { ...prev.input, ...patch } } : prev));

  return (
    <PageContainer>
      <PageHeader
        title="Forecast schedules"
        description="Runs that start automatically. Scheduled runs are validated like manual runs and wait for review unless automatic publication is on."
        actions={
          manage ? (
            <Button variant="primary" onClick={() => setEditing({ id: null, input: { ...EMPTY } })}>
              <Plus aria-hidden /> Create schedule
            </Button>
          ) : undefined
        }
      />
      {!manage && <PermissionNotice permission="forecast.run.create" compact message="You can see schedules but not change them." />}
      <DataTable
        label="Forecast schedules"
        columns={columns}
        data={q.data}
        getRowId={(s) => s.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Schedules could not be loaded."
        hideDensityToggle
        empty={
          <EmptyState
            icon={CalendarClock}
            title="No forecast schedules in this workspace."
            description="Schedule a daily refresh so the planning baseline stays current without manual runs."
            action={manage ? <Button variant="primary" onClick={() => setEditing({ id: null, input: { ...EMPTY } })}>Create schedule</Button> : undefined}
          />
        }
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && e && (
          <DialogContent
            size="lg"
            title={editing.id ? `Edit schedule · ${e.name}` : "Create schedule"}
            description="Times use the workspace time zone. Scheduled runs use the workspace history window."
            footer={
              <>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(editing)}>
                  {editing.id ? "Save schedule" : "Create schedule"}
                </Button>
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Name" htmlFor="sch-name" required>
                <Input id="sch-name" value={e.name} onChange={(x) => set({ name: x.target.value })} placeholder="e.g. Daily refresh · All categories" autoFocus />
              </Field>
              <Field label="Frequency" htmlFor="sch-freq">
                <Select
                  id="sch-freq"
                  value={e.cadence.type === "daily" ? "daily" : String(e.cadence.weekday)}
                  onValueChange={(v) => set({ cadence: v === "daily" ? { type: "daily" } : { type: "weekly", weekday: Number(v) } })}
                  options={[{ value: "daily", label: "Every day" }, ...WEEKDAYS.map((d, i) => ({ value: String(i), label: `Every ${d}` }))]}
                />
              </Field>
              <Field label="Time" htmlFor="sch-time" hint="24-hour, HH:MM. Data sources finish loading by 05:00.">
                <Input id="sch-time" type="time" value={e.time} onChange={(x) => set({ time: x.target.value })} />
              </Field>
              <Field label="Categories" htmlFor="sch-cats" hint="Empty means all.">
                <MultiSelect id="sch-cats" value={e.categories} onChange={(v) => set({ categories: v })} allLabel="All categories" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Regions" htmlFor="sch-regions" hint="Empty means all.">
                <MultiSelect id="sch-regions" value={e.regions} onChange={(v) => set({ regions: v })} allLabel="All regions" options={REGIONS.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Horizon" htmlFor="sch-h">
                <Select id="sch-h" value={String(e.horizonDays)} onValueChange={(v) => set({ horizonDays: Number(v) })} options={[7, 14, 28, 30, 60, 90].map((d) => ({ value: String(d), label: `${d} days` }))} />
              </Field>
              <Field label="Model" htmlFor="sch-model" hint="“Workspace default” follows approved default-model changes.">
                <Select
                  id="sch-model"
                  value={e.modelId ?? "default"}
                  onValueChange={(v) => set({ modelId: v === "default" ? null : v })}
                  options={[{ value: "default", label: "Workspace default" }, ...(models.data ?? []).filter((m) => m.status !== "archived").map((m) => ({ value: m.id, label: `${m.name} ${m.version}`, description: m.status }))]}
                />
              </Field>
            </div>
            <div className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
              <SwitchField id="sch-enabled" label="Enabled" description="Paused schedules keep their configuration but do not start runs." checked={e.enabled} onCheckedChange={(v) => set({ enabled: v })} />
              <SwitchField
                id="sch-auto"
                label="Publish automatically"
                description={can("forecast.run.publish") ? "Only when validation has no warnings and no critical exceptions are raised. Otherwise the run waits for review." : "Needs publish rights (Manager or Administrator)."}
                checked={e.autoPublish}
                disabled={!can("forecast.run.publish")}
                onCheckedChange={(v) => set({ autoPublish: v })}
              />
            </div>
            {e.autoPublish && (
              <InlineAlert tone="warning" title="Automatic publication replaces the planning baseline without a person reviewing it." className="mt-3">
                Overview, exceptions and new plans switch to the new run as soon as it completes. Every automatic publication is still recorded in the audit log.
              </InlineAlert>
            )}
          </DialogContent>
        )}
      </Dialog>

      <TypedConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete schedule “${deleting?.name ?? ""}”?`}
        resourceName={deleting?.name ?? ""}
        confirmLabel="Delete schedule"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        consequences={[
          { label: "Consequence", value: "No further runs start from this schedule. Past runs are kept.", emphasis: true },
          { label: "Alternative", value: "Pause the schedule to keep its configuration." },
        ]}
      />
    </PageContainer>
  );
}
