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
import { pick } from "@/lib/i18n";

export function cadenceLabel(s: Pick<ForecastSchedule, "cadence" | "time">) {
  return s.cadence.type === "daily" ? pick(`Setiap hari pukul ${s.time}`, `Every day at ${s.time}`) : pick(`Setiap ${WEEKDAYS[s.cadence.weekday]} pukul ${s.time}`, `Every ${WEEKDAYS[s.cadence.weekday]} at ${s.time}`);
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
    success: (s) => pick(`Jadwal “${s.name}” tersimpan`, `Schedule “${s.name}” saved`),
    successDescription: (s) => pick(`Proses berikutnya ${s.enabled ? "sesuai jadwal" : "dijeda"}.`, `Next run ${s.enabled ? "as scheduled" : "paused"}.`),
    failure: pick("Jadwal tidak dapat disimpan.", "The schedule was not saved."),
    onSuccess: () => setEditing(null),
  });
  const toggle = useApiMutation((c, v: { id: string; enabled: boolean }) => setScheduleEnabled(c, v.id, v.enabled), { invalidate: inv, success: (s) => pick(`${s.name} ${s.enabled ? "dilanjutkan" : "dijeda"}`, `${s.name} ${s.enabled ? "resumed" : "paused"}`), failure: pick("Jadwal tidak dapat diubah.", "The schedule was not changed.") });
  const remove = useApiMutation((c, id: string) => deleteSchedule(c, id), { invalidate: inv, success: pick("Jadwal dihapus", "Schedule deleted"), failure: pick("Jadwal tidak dapat dihapus.", "The schedule was not deleted."), onSuccess: () => setDeleting(null) });
  const runNow = useApiMutation((c, id: string) => runScheduleNow(c, id), {
    invalidate: inv,
    success: (r) => pick(`${r.id} dimulai`, `Started ${r.id}`),
    failure: pick("Proses tidak dimulai.", "The run did not start."),
    onSuccess: (r) => {
      track("forecast_run_started", { source: "schedule" });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });

  const columns = React.useMemo<ColumnDef<ScheduleRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: pick("Jadwal", "Schedule"),
        meta: { width: "minmax(240px, 2fr)", pinned: true, label: pick("Jadwal", "Schedule") } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.name}</span>
            <span className="truncate text-xs text-fg-tertiary">
              {row.original.categories.length ? row.original.categories.join(", ") : pick("Semua kategori", "All categories")} · {row.original.regions.length ? row.original.regions.join(", ") : pick("Semua wilayah", "All regions")} · {row.original.horizonDays} h
            </span>
          </span>
        ),
      },
      { id: "cadence", header: pick("Irama", "Cadence"), meta: { width: "minmax(170px, 1fr)" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{cadenceLabel(row.original)}</span> },
      {
        id: "next",
        header: pick("Proses berikutnya", "Next run"),
        meta: { width: "170px" } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.nextRunAt ? <span className="tabular" title={formatDateTime(row.original.nextRunAt)}>{formatRelative(row.original.nextRunAt)}</span> : <span className="text-fg-tertiary">{pick("Dijeda", "Paused")}</span>),
      },
      {
        id: "last",
        header: pick("Proses terakhir", "Latest run"),
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
            <span className="text-fg-tertiary">{pick("Belum pernah", "Never")}</span>
          ),
      },
      {
        id: "publish",
        header: pick("Penerbitan", "Publication"),
        meta: { width: "140px", hideBelow: "md", description: pick("Penerbitan otomatis menggantikan acuan perencanaan tanpa ditinjau.", "Auto-publish replaces the planning baseline without review.") } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.autoPublish ? <Tag tone="warning">{pick("Otomatis", "Automatic")}</Tag> : <Tag>{pick("Tinjau manual", "Manual review")}</Tag>),
      },
      { id: "owner", header: pick("Penanggung jawab", "Owner"), meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      {
        id: "status",
        header: "Status",
        meta: { width: "110px" } satisfies ColumnMeta,
        cell: ({ row }) => <StatusBadge status={row.original.enabled ? "active" : "paused"} label={row.original.enabled ? pick("Aktif", "Enabled") : pick("Dijeda", "Paused")} size="sm" />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">{pick("Aksi", "Actions")}</span>,
        meta: { width: "52px", pinned: true, label: pick("Aksi", "Actions") } satisfies ColumnMeta,
        cell: ({ row }) => {
          const s = row.original;
          if (!manage) return null;
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon-sm" variant="ghost" aria-label={pick(`Aksi untuk ${s.name}`, `Actions for ${s.name}`)}>
                  <MoreHorizontal aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem icon={<Play />} onSelect={() => runNow.mutate(s.id)}>
                  {pick("Jalankan sekarang", "Run now")}
                </DropdownMenuItem>
                <DropdownMenuItem icon={<Pencil />} onSelect={() => setEditing({ id: s.id, input: { name: s.name, cadence: s.cadence, time: s.time, categories: s.categories, regions: s.regions, horizonDays: s.horizonDays, modelId: s.modelId, autoPublish: s.autoPublish, enabled: s.enabled } })}>
                  {pick("Ubah jadwal", "Edit schedule")}
                </DropdownMenuItem>
                <DropdownMenuItem icon={s.enabled ? <Pause /> : <Play />} onSelect={() => toggle.mutate({ id: s.id, enabled: !s.enabled })}>
                  {s.enabled ? pick("Jeda", "Pause") : pick("Lanjutkan", "Resume")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem icon={<Trash2 />} destructive onSelect={() => setDeleting(s)}>
                  {pick("Hapus jadwal", "Delete schedule")}
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
        title={pick("Jadwal Perkiraan", "Forecast schedules")}
        description={pick("Proses yang berjalan otomatis. Proses terjadwal diperiksa seperti proses manual dan menunggu tinjauan kecuali penerbitan otomatis aktif.", "Runs that start automatically. Scheduled runs are validated like manual runs and wait for review unless automatic publication is on.")}
        actions={
          manage ? (
            <Button variant="primary" onClick={() => setEditing({ id: null, input: { ...EMPTY } })}>
              <Plus aria-hidden /> {pick("Buat jadwal", "Create schedule")}
            </Button>
          ) : undefined
        }
      />
      {!manage && <PermissionNotice permission="forecast.run.create" compact message={pick("Anda dapat melihat jadwal, tetapi tidak mengubahnya.", "You can see schedules but not change them.")} />}
      <DataTable
        label={pick("Jadwal perkiraan", "Forecast schedules")}
        columns={columns}
        data={q.data}
        getRowId={(s) => s.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat={pick("Jadwal tidak dapat dimuat.", "Schedules could not be loaded.")}
        empty={
          <EmptyState
            icon={CalendarClock}
            title={pick("Belum ada jadwal perkiraan di ruang kerja ini.", "No forecast schedules in this workspace.")}
            description={pick("Jadwalkan penyegaran harian agar acuan perencanaan tetap terbaru tanpa proses manual.", "Schedule a daily refresh so the planning baseline stays current without manual runs.")}
            action={manage ? <Button variant="primary" onClick={() => setEditing({ id: null, input: { ...EMPTY } })}>{pick("Buat jadwal", "Create schedule")}</Button> : undefined}
          />
        }
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && e && (
          <DialogContent
            size="lg"
            title={editing.id ? pick(`Ubah jadwal · ${e.name}`, `Edit schedule · ${e.name}`) : pick("Buat jadwal", "Create schedule")}
            description={pick("Waktu memakai zona waktu ruang kerja. Proses terjadwal memakai rentang historis ruang kerja.", "Times use the workspace time zone. Scheduled runs use the workspace history window.")}
            footer={
              <>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  {pick("Batal", "Cancel")}
                </Button>
                <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(editing)}>
                  {editing.id ? pick("Simpan jadwal", "Save schedule") : pick("Buat jadwal", "Create schedule")}
                </Button>
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label={pick("Nama", "Name")} htmlFor="sch-name" required>
                <Input id="sch-name" value={e.name} onChange={(x) => set({ name: x.target.value })} placeholder={pick("mis. Pembaruan harian · Semua kategori", "e.g. Daily refresh · All categories")} autoFocus />
              </Field>
              <Field label={pick("Frekuensi", "Frequency")} htmlFor="sch-freq">
                <Select
                  id="sch-freq"
                  value={e.cadence.type === "daily" ? "daily" : String(e.cadence.weekday)}
                  onValueChange={(v) => set({ cadence: v === "daily" ? { type: "daily" } : { type: "weekly", weekday: Number(v) } })}
                  options={[{ value: "daily", label: pick("Setiap hari", "Every day") }, ...WEEKDAYS.map((d, i) => ({ value: String(i), label: pick(`Setiap ${d}`, `Every ${d}`) }))]}
                />
              </Field>
              <Field label={pick("Waktu", "Time")} htmlFor="sch-time" hint={pick("Format 24 jam, HH:MM. Sumber data selesai dimuat paling lambat pukul 05:00.", "24-hour, HH:MM. Data sources finish loading by 05:00.")}>
                <Input id="sch-time" type="time" value={e.time} onChange={(x) => set({ time: x.target.value })} />
              </Field>
              <Field label={pick("Kategori", "Categories")} htmlFor="sch-cats" hint={pick("Kosong berarti semua.", "Empty means all.")}>
                <MultiSelect id="sch-cats" value={e.categories} onChange={(v) => set({ categories: v })} allLabel={pick("Semua kategori", "All categories")} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label={pick("Wilayah", "Regions")} htmlFor="sch-regions" hint={pick("Kosong berarti semua.", "Empty means all.")}>
                <MultiSelect id="sch-regions" value={e.regions} onChange={(v) => set({ regions: v })} allLabel={pick("Semua wilayah", "All regions")} options={REGIONS.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label={pick("Periode", "Horizon")} htmlFor="sch-h">
                <Select id="sch-h" value={String(e.horizonDays)} onValueChange={(v) => set({ horizonDays: Number(v) })} options={[7, 14, 28, 30, 60, 90].map((d) => ({ value: String(d), label: pick(`${d} hari`, `${d} days`) }))} />
              </Field>
              <Field label={pick("Model", "Model")} htmlFor="sch-model" hint={pick("“Bawaan ruang kerja” mengikuti perubahan model bawaan yang disetujui.", "“Workspace default” follows approved default-model changes.")}>
                <Select
                  id="sch-model"
                  value={e.modelId ?? "default"}
                  onValueChange={(v) => set({ modelId: v === "default" ? null : v })}
                  options={[{ value: "default", label: pick("Bawaan ruang kerja", "Workspace default") }, ...(models.data ?? []).filter((m) => m.status !== "archived").map((m) => ({ value: m.id, label: `${m.name} ${m.version}`, description: m.status }))]}
                />
              </Field>
            </div>
            <div className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
              <SwitchField id="sch-enabled" label={pick("Aktif", "Enabled")} description={pick("Jadwal yang dijeda menyimpan pengaturannya, tetapi tidak menjalankan proses.", "Paused schedules keep their configuration but do not start runs.")} checked={e.enabled} onCheckedChange={(v) => set({ enabled: v })} />
              <SwitchField
                id="sch-auto"
                label={pick("Terbitkan otomatis", "Publish automatically")}
                description={can("forecast.run.publish") ? pick("Hanya bila pemeriksaan tidak menemukan peringatan dan tidak ada item kritis. Jika tidak, proses menunggu tinjauan.", "Only when validation has no warnings and no critical exceptions are raised. Otherwise the run waits for review.") : pick("Memerlukan hak menerbitkan (Manajer atau Administrator).", "Needs publish rights (Manager or Administrator).")}
                checked={e.autoPublish}
                disabled={!can("forecast.run.publish")}
                onCheckedChange={(v) => set({ autoPublish: v })}
              />
            </div>
            {e.autoPublish && (
              <InlineAlert tone="warning" title={pick("Penerbitan otomatis menggantikan acuan perencanaan tanpa ditinjau orang.", "Automatic publication replaces the planning baseline without a person reviewing it.")} className="mt-3">
                {pick("Ringkasan, item tinjauan, dan rencana baru langsung memakai proses baru begitu selesai. Setiap penerbitan otomatis tetap tercatat di riwayat aktivitas.", "Overview, exceptions and new plans switch to the new run as soon as it completes. Every automatic publication is still recorded in the audit log.")}
              </InlineAlert>
            )}
          </DialogContent>
        )}
      </Dialog>

      <TypedConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={pick(`Hapus jadwal “${deleting?.name ?? ""}”?`, `Delete schedule “${deleting?.name ?? ""}”?`)}
        resourceName={deleting?.name ?? ""}
        confirmLabel={pick("Hapus jadwal", "Delete schedule")}
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        consequences={[
          { label: pick("Dampak", "Consequence"), value: pick("Tidak ada proses lagi yang dijalankan dari jadwal ini. Proses sebelumnya tetap disimpan.", "No further runs start from this schedule. Past runs are kept."), emphasis: true },
          { label: pick("Alternatif", "Alternative"), value: pick("Jeda jadwalnya untuk menyimpan pengaturannya.", "Pause the schedule to keep its configuration.") },
        ]}
      />
    </PageContainer>
  );
}
