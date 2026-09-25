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
  return s.cadence.type === "daily" ? `Setiap hari pukul ${s.time}` : `Setiap ${WEEKDAYS[s.cadence.weekday]} pukul ${s.time}`;
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
    failure: "Jadwal tidak dapat disimpan.",
    onSuccess: () => setEditing(null),
  });
  const toggle = useApiMutation((c, v: { id: string; enabled: boolean }) => setScheduleEnabled(c, v.id, v.enabled), { invalidate: inv, success: (s) => `${s.name} ${s.enabled ? "dilanjutkan" : "dijeda"}`, failure: "Jadwal tidak dapat diubah." });
  const remove = useApiMutation((c, id: string) => deleteSchedule(c, id), { invalidate: inv, success: "Jadwal dihapus", failure: "Jadwal tidak dapat dihapus.", onSuccess: () => setDeleting(null) });
  const runNow = useApiMutation((c, id: string) => runScheduleNow(c, id), {
    invalidate: inv,
    success: (r) => `Started ${r.id}`,
    failure: "Proses tidak dimulai.",
    onSuccess: (r) => {
      track("forecast_run_started", { source: "schedule" });
      router.push(`/forecasting/runs/${r.id}`);
    },
  });

  const columns = React.useMemo<ColumnDef<ScheduleRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: "Jadwal",
        meta: { width: "minmax(240px, 2fr)", pinned: true, label: "Jadwal" } satisfies ColumnMeta,
        cell: ({ row }) => (
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[0.8125rem] font-semibold">{row.original.name}</span>
            <span className="truncate text-xs text-fg-tertiary">
              {row.original.categories.length ? row.original.categories.join(", ") : "Semua kategori"} · {row.original.regions.length ? row.original.regions.join(", ") : "Semua wilayah"} · {row.original.horizonDays} h
            </span>
          </span>
        ),
      },
      { id: "cadence", header: "Irama", meta: { width: "minmax(170px, 1fr)" } satisfies ColumnMeta, cell: ({ row }) => <span className="text-fg-secondary">{cadenceLabel(row.original)}</span> },
      {
        id: "next",
        header: "Proses berikutnya",
        meta: { width: "170px" } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.nextRunAt ? <span className="tabular" title={formatDateTime(row.original.nextRunAt)}>{formatRelative(row.original.nextRunAt)}</span> : <span className="text-fg-tertiary">Dijeda</span>),
      },
      {
        id: "last",
        header: "Proses terakhir",
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
        header: "Penerbitan",
        meta: { width: "140px", hideBelow: "md", description: "Penerbitan otomatis menggantikan acuan perencanaan tanpa ditinjau." } satisfies ColumnMeta,
        cell: ({ row }) => (row.original.autoPublish ? <Tag tone="warning">Otomatis</Tag> : <Tag>Tinjau manual</Tag>),
      },
      { id: "owner", header: "Penanggung jawab", meta: { width: "minmax(140px, 1fr)", hideBelow: "xl" } satisfies ColumnMeta, cell: ({ row }) => <UserIdentity userId={row.original.ownerId} /> },
      {
        id: "status",
        header: "Status",
        meta: { width: "110px" } satisfies ColumnMeta,
        cell: ({ row }) => <StatusBadge status={row.original.enabled ? "active" : "paused"} label={row.original.enabled ? "Enabled" : "Paused"} size="sm" />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Aksi</span>,
        meta: { width: "52px", pinned: true, label: "Aksi" } satisfies ColumnMeta,
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
        title="Jadwal Perkiraan"
        description="Proses yang berjalan otomatis. Proses terjadwal diperiksa seperti proses manual dan menunggu tinjauan kecuali penerbitan otomatis aktif."
        actions={
          manage ? (
            <Button variant="primary" onClick={() => setEditing({ id: null, input: { ...EMPTY } })}>
              <Plus aria-hidden /> Create schedule
            </Button>
          ) : undefined
        }
      />
      {!manage && <PermissionNotice permission="forecast.run.create" compact message="Anda dapat melihat jadwal, tetapi tidak mengubahnya." />}
      <DataTable
        label="Jadwal perkiraan"
        columns={columns}
        data={q.data}
        getRowId={(s) => s.id}
        isLoading={q.isPending}
        error={q.error}
        onRetry={() => q.refetch()}
        errorWhat="Jadwal tidak dapat dimuat."
        hideDensityToggle
        empty={
          <EmptyState
            icon={CalendarClock}
            title="Belum ada jadwal perkiraan di ruang kerja ini."
            description="Jadwalkan penyegaran harian agar acuan perencanaan tetap terbaru tanpa proses manual."
            action={manage ? <Button variant="primary" onClick={() => setEditing({ id: null, input: { ...EMPTY } })}>Buat jadwal</Button> : undefined}
          />
        }
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        {editing && e && (
          <DialogContent
            size="lg"
            title={editing.id ? `Ubah jadwal · ${e.name}` : "Buat jadwal"}
            description="Waktu memakai zona waktu ruang kerja. Proses terjadwal memakai rentang historis ruang kerja."
            footer={
              <>
                <Button variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button variant="primary" loading={save.isPending} onClick={() => save.mutate(editing)}>
                  {editing.id ? "Simpan jadwal" : "Buat jadwal"}
                </Button>
              </>
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field className="sm:col-span-2" label="Name" htmlFor="sch-name" required>
                <Input id="sch-name" value={e.name} onChange={(x) => set({ name: x.target.value })} placeholder="e.g. Daily refresh · All categories" autoFocus />
              </Field>
              <Field label="Frekuensi" htmlFor="sch-freq">
                <Select
                  id="sch-freq"
                  value={e.cadence.type === "daily" ? "daily" : String(e.cadence.weekday)}
                  onValueChange={(v) => set({ cadence: v === "daily" ? { type: "daily" } : { type: "weekly", weekday: Number(v) } })}
                  options={[{ value: "daily", label: "Setiap hari" }, ...WEEKDAYS.map((d, i) => ({ value: String(i), label: `Setiap ${d}` }))]}
                />
              </Field>
              <Field label="Waktu" htmlFor="sch-time" hint="Format 24 jam, HH:MM. Sumber data selesai dimuat paling lambat pukul 05:00.">
                <Input id="sch-time" type="time" value={e.time} onChange={(x) => set({ time: x.target.value })} />
              </Field>
              <Field label="Kategori" htmlFor="sch-cats" hint="Kosong berarti semua.">
                <MultiSelect id="sch-cats" value={e.categories} onChange={(v) => set({ categories: v })} allLabel="Semua kategori" options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Wilayah" htmlFor="sch-regions" hint="Kosong berarti semua.">
                <MultiSelect id="sch-regions" value={e.regions} onChange={(v) => set({ regions: v })} allLabel="Semua wilayah" options={REGIONS.map((c) => ({ value: c, label: c }))} />
              </Field>
              <Field label="Horizon" htmlFor="sch-h">
                <Select id="sch-h" value={String(e.horizonDays)} onValueChange={(v) => set({ horizonDays: Number(v) })} options={[7, 14, 28, 30, 60, 90].map((d) => ({ value: String(d), label: `${d} days` }))} />
              </Field>
              <Field label="Model" htmlFor="sch-model" hint="“Workspace default” follows approved default-model changes.">
                <Select
                  id="sch-model"
                  value={e.modelId ?? "default"}
                  onValueChange={(v) => set({ modelId: v === "default" ? null : v })}
                  options={[{ value: "default", label: "Bawaan ruang kerja" }, ...(models.data ?? []).filter((m) => m.status !== "archived").map((m) => ({ value: m.id, label: `${m.name} ${m.version}`, description: m.status }))]}
                />
              </Field>
            </div>
            <div className="mt-4 divide-y divide-border-subtle border-t border-border-subtle">
              <SwitchField id="sch-enabled" label="Aktif" description="Jadwal yang dijeda menyimpan pengaturannya, tetapi tidak menjalankan proses." checked={e.enabled} onCheckedChange={(v) => set({ enabled: v })} />
              <SwitchField
                id="sch-auto"
                label="Terbitkan otomatis"
                description={can("forecast.run.publish") ? "Hanya bila pemeriksaan tidak menemukan peringatan dan tidak ada item kritis. Jika tidak, proses menunggu tinjauan." : "Memerlukan hak menerbitkan (Manajer atau Administrator)."}
                checked={e.autoPublish}
                disabled={!can("forecast.run.publish")}
                onCheckedChange={(v) => set({ autoPublish: v })}
              />
            </div>
            {e.autoPublish && (
              <InlineAlert tone="warning" title="Penerbitan otomatis menggantikan acuan perencanaan tanpa ditinjau orang." className="mt-3">
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
        confirmLabel="Hapus jadwal"
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id)}
        consequences={[
          { label: "Dampak", value: "Tidak ada proses lagi yang dijalankan dari jadwal ini. Proses sebelumnya tetap disimpan.", emphasis: true },
          { label: "Alternatif", value: "Jeda jadwalnya untuk menyimpan pengaturannya." },
        ]}
      />
    </PageContainer>
  );
}
