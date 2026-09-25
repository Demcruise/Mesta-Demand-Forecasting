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
  { key: "approval_requested", label: "Perlu persetujuan", description: "Ada permintaan yang menunggu keputusan Anda. Selalu tampil di aplikasi.", locked: true },
  { key: "approval_completed", label: "Persetujuan selesai", description: "Permintaan yang Anda ajukan atau ikuti sudah diputuskan." },
  { key: "forecast_completed", label: "Perkiraan selesai", description: "Sebuah proses selesai diproses." },
  { key: "forecast_failed", label: "Perkiraan gagal", description: "Sebuah proses berhenti karena kesalahan." },
  { key: "exception_opened", label: "Perlu ditinjau", description: "Item baru di atas tingkat minimum Anda." },
  { key: "data_quality", label: "Masalah kualitas data", description: "Ada pemeriksaan data yang gagal atau memberi peringatan." },
  { key: "data_freshness", label: "Data belum diperbarui", description: "Ada sumber data yang terlambat atau gagal." },
  { key: "scenario_completed", label: "Skenario disimulasikan", description: "Simulasi skenario selesai." },
  { key: "model_issue", label: "Masalah model", description: "Ada penyimpangan atau penurunan performa pada model produksi." },
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
    success: "Aturan notifikasi tersimpan",
    failure: "Aturan notifikasi tidak tersimpan.",
  });

  if (q.isPending || !draft) return <Panel><TableSkeleton rows={6} columns={3} /></Panel>;
  if (q.isError) return <ErrorState what="Aturan notifikasi tidak dapat dimuat." error={q.error} onRetry={() => q.refetch()} />;
  const dirty = JSON.stringify(draft) !== JSON.stringify(q.data);
  const toggle = (cat: NotificationCategory, ch: NotificationChannel, on: boolean) =>
    setDraft((d) => {
      if (!d) return d;
      const current = d.channels[cat] ?? [];
      return { ...d, channels: { ...d.channels, [cat]: on ? [...current, ch] : current.filter((x) => x !== ch) } };
    });

  return (
    <Panel
      title="Notifikasi"
      description={`Where and when Mesta notifies you (${session.email}). These rules apply only to you.`}
      footer={
        <>
          <span className="caption">{dirty ? "Perubahan belum disimpan" : "Tidak ada perubahan belum disimpan"}</span>
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
          <caption className="sr-only">Saluran pengiriman per kejadian</caption>
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
        <Field label="Tingkat minimum" htmlFor="nr-sev" hint="Item di bawah tingkat ini tidak akan memberi tahu Anda.">
          <Select
            id="nr-sev"
            value={draft.minExceptionSeverity}
            onValueChange={(v) => setDraft({ ...draft, minExceptionSeverity: v as Severity })}
            options={[
              { value: "info", label: "Info ke atas" },
              { value: "warning", label: "Peringatan ke atas" },
              { value: "critical", label: "Hanya kritis" },
            ]}
          />
        </Field>
        <Field label="Ringkasan email" htmlFor="nr-digest" hint="Menggabungkan email yang tidak mendesak menjadi satu pesan.">
          <Select
            id="nr-digest"
            value={draft.digest}
            onValueChange={(v) => setDraft({ ...draft, digest: v as NotificationRules["digest"] })}
            options={[
              { value: "off", label: "Kirim segera" },
              { value: "daily", label: "Harian pukul 08:00" },
              { value: "weekly", label: "Mingguan pada Senin" },
            ]}
          />
        </Field>
      </div>
      <div className="mt-2 border-t border-border-subtle">
        <SwitchField id="nr-quiet" label="Jam tenang" description="Tahan email notifikasi selama jam ini. Proses yang gagal dan permintaan persetujuan tetap masuk ke aplikasi." checked={draft.quietHours.enabled} onCheckedChange={(v) => setDraft({ ...draft, quietHours: { ...draft.quietHours, enabled: v } })} />
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
